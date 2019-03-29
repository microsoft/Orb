// This is originally from https://github.com/kaivi/ReactInlineEdit, has been modified to fit our use case.

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import InlineEditBase from './inlineEditBase';

export default class InlineEdit extends InlineEditBase {
    constructor(props) {
        super(props);
        this.state = {
            editing: this.props.editingByDefault
        };

        this.startEditing = this.startEditing.bind(this);
        this.finishEditing = this.finishEditing.bind(this);
        this.cancelEditing = this.cancelEditing.bind(this);
        this.keyDown = this.keyDown.bind(this);
        this.textChanged = this.textChanged.bind(this);
        this.elementBlur = this.elementBlur.bind(this);
        this.elementClick = this.elementClick.bind(this);
    }

    startEditing() {
        this.setState({ editing: true });
    }

    finishEditing() {
        let newValue = (ReactDOM.findDOMNode(this.refs['input']) as any).value;
        this.doValidations(newValue);
        if (!this.state.invalid && this.props.value !== newValue) {
            this.commit(newValue);
            if (this.props.onFinish) {
                this.props.onFinish(newValue);
            }
        }
        this.cancelEditing();
    }

    cancelEditing() {
        if (this.props.onCancel) {
            this.props.onCancel();
        }

        this.setState({ editing: false, invalid: false });
    }

    keyDown(event) {
        if (event.keyCode === 13) { this.finishEditing() }
        else if (event.keyCode === 27) { this.cancelEditing() }
    }

    textChanged(event) {
        this.doValidations(event.target.value.trim());
    }

    componentDidUpdate(prevProps, prevState) {
        var inputElem = ReactDOM.findDOMNode(this.refs['input']);
        if (this.state.editing && !prevState.editing) {
            (inputElem as any).focus();
            this.selectInputText(inputElem);
        } else if (this.state.editing && prevProps.text != this.props.text) {
            this.finishEditing();
        }
    }

    renderEditingComponent() {
        return (
            <div style={this.props.style}>
                <input
                    autoFocus={true}
                    disabled={this.state.loading}
                    className={this.makeClassString()}
                    defaultValue={this.props.value}
                    onInput={this.textChanged}
                    onBlur={this.finishEditing}
                    ref="input"
                    onKeyDown={this.keyDown}
                    {...this.props.editProps} />
            </div>);
    }

    renderNormalComponent = () => {
        return (
            <div style={this.props.style}>
                <span
                    tabIndex={0}
                    className={this.makeClassString()}
                    onFocus={this.startEditing}
                    onClick={this.startEditing}
                    {...this.props.defaultProps}>{this.state.newValue || this.props.value}</span>
            </div>);
    }

    elementBlur(event) {
        this.finishEditing();
    }

    elementClick(event) {
        this.startEditing();
        event.target.element.focus();
    }

    render() {
        if (this.state.editing) {
            return this.renderEditingComponent();
        } else {
            return this.renderNormalComponent();
        }
    }
}