//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import { ipcRenderer } from "electron";
import FlatButton from 'material-ui/FlatButton';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import * as injectTapEventPluginExport from 'react-tap-event-plugin';

class CertSelectorState {
    certs: any[]
}

/*
 * Displays a set of certificates provided by the Main process.
 * The selected certificate is sent back to the Main process.
 */
class CertSelector extends React.Component<any, CertSelectorState> {
    constructor() {
        super();

        this.state = new CertSelectorState();
        this.handleClick = this.handleClick.bind(this);

        ipcRenderer.on('select-client-certificate', (event, arg) => {
            this.setState({ certs: arg });
        })
    }

    render() {

        let certs = <div>No certificates found. Please login with your smartcard and retry.</div>
        if (this.state.certs) {
            certs =
                <div>
                    {this.state.certs.map((v, i) => {
                        return <div key={v.serialNumber}><FlatButton label={v.issuerName} primary={true} onClick={e => this.handleClick(e, v)}></FlatButton></div>
                    })
                    }
                </div>
        }
        return certs;
    }

    handleClick(event, value) {
        // send the cert to the main window.
        ipcRenderer.send('client-certificate-selected', value);
    }
}

// Required to keep material-ui happy
// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPluginExport();

const App = () => (
    <div>
        <MuiThemeProvider>
            <CertSelector></CertSelector>
        </MuiThemeProvider>
    </div>
);


ReactDOM.render(
    <App />,
    document.getElementById('react-app')
);
