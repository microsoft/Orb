//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />
/// <reference path="./dialog.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import { ipcRenderer } from "electron";
import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import * as injectTapEventPluginExport from 'react-tap-event-plugin';

class DialogState {
    input?: DialogInput
    values?: { [key: string]: any }
    arrayDelimiters?: { [key: string]: string }
    sender?: any
}

const styles = {
    text: {
        paddingTop: 2,
        fontFamily: "Roboto, sans-serif",
        fontSize: 16.5
    },
    buttons: {
        position: "absolute",
        right: 1,
        marginTop: 15
    } as React.CSSProperties,
    delimiter: {
        fontSize: 13
    }
};

/*
 * Displays a dialog with field inputs.
 */
class Dialog extends React.Component<any, DialogState> {

    constructor() {
        super();

        this.state = new DialogState();
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.handleFieldChange = this.handleFieldChange.bind(this);
        this.handleDelimiterChange = this.handleDelimiterChange.bind(this);

        ipcRenderer.on('dialog-input', (event, arg: DialogInput) => {
            if (!arg.message && arg.inputFields.length > 0) {
                arg.message = "Supply values for the following parameters:";
            }

            this.setState({ input: arg, values: {}, arrayDelimiters: {}, sender: event.sender });
        })
    }

    handleFieldChange(event, field: string) {
        this.state.values[field] = event.target.value as string;
    }

    handleDelimiterChange(event, field: string) {
        let delimiter = event.target.value as string;
        this.state.arrayDelimiters[field] = delimiter;
    }

    handleSubmit() {

        // Handle array delimiters
        for (var key in this.state.arrayDelimiters) {
            if (this.state.arrayDelimiters.hasOwnProperty(key)) {
                let delimiter = this.state.arrayDelimiters[key];
                if (delimiter) {
                    let original = this.state.values[key] as string;
                    if (original) {
                        this.state.values[key] = original.split(delimiter);
                    }
                }
            }
        }

        let output: DialogOutput = {
            cancelled: false,
            promiseId: this.state.input.promiseId,
            fieldValues: this.state.values
        }

        //console.log(output);

        this.state.sender.send('dialog-output', output);
    }

    handleCancel() {
        let output: DialogOutput = {
            cancelled: true,
            promiseId: this.state.input.promiseId,
            fieldValues: {}
        }

        this.state.sender.send('dialog-output', output);
    }

    renderFields() {
        let fields = <div>No Input Fields Specified.</div>;
        if (this.state.input.inputFields) {
            fields = <div>
                {this.state.input.inputFields.map((f, i) => {
                    let label = f.Name;
                    if (f.Type) {
                        label += (" (" + f.Type + ")")
                    }

                    let type = f.IsSecureString ? "password" : "text";
                    let textField = <TextField autoFocus={i === 0} type={type} key={f.Name} multiLine={!f.IsSecureString} fullWidth={true} floatingLabelText={label} onChange={(event) => this.handleFieldChange(event, f.Name)} />;

                    if (!f.IsArray) {
                        return textField;
                    }
                    return (
                        <div key={f.Name + "array"}>
                            {textField}
                            <TextField style={styles.delimiter} floatingLabelText={f.Name + " Array Delimiter (Optional)"} multiLine={true} onChange={(event) => this.handleDelimiterChange(event, f.Name)} />
                        </div>);

                })}
            </div>
        }

        return fields;
    }

    renderCaption() {
        let result = <div></div>
        if (this.state.input.caption) {
            result =
                <div style={styles.text}>
                    <hr />
                    {this.state.input.caption}
                </div>
        }
        return result;
    }

    render() {

        let content = <div>Waiting for dialog input.</div>
        if (this.state.input) {
            content =
                <div>
                    <div style={styles.text}>
                        {this.state.input.message}
                    </div>
                    {this.renderCaption()}
                    {this.renderFields()}
                    <div style={styles.buttons}>
                        <FlatButton label={"Submit"} onTouchTap={this.handleSubmit} primary={true} />
                        <FlatButton label={"Cancel"} onTouchTap={this.handleCancel} primary={true} />
                    </div>
                </div>
        }

        return content;
    }

}

// Required to keep material-ui happy
// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPluginExport();

const App = () => (
    <div>
        <MuiThemeProvider>
            <Dialog></Dialog>
        </MuiThemeProvider>
    </div>
);


ReactDOM.render(
    <App />,
    document.getElementById('react-app')
);
