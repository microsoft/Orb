// This is originally from https://github.com/kaivi/ReactInlineEdit, has been modified to fit our use case.

import * as React from 'react';

interface Props {
    value: any;
    change: (newState: any) => any;
    propName: string
    editProps?: Object,
    defaultProps?: Object,
    isDisabled?: boolean,
    validate?: (value: any) => boolean,
    shouldBlockWhileLoading?: boolean,
    classLoading?: string,
    classEditing?: string,
    classDisabled?: string,
    classInvalid?: string,
    className?: string,
    editingByDefault: boolean,
    text?: string,
    onFinish?: (text: string) => void,
    onCancel?: () => void,
    style?: any;
}

interface State {
    editing?: boolean,
    loading?: boolean,
    disabled?: boolean,
    invalid?: boolean,
    newValue?: string
}

export default class InlineEditBase extends React.Component<Props, State> {
    constructor(props) {
        super(props);

        this.doValidations = this.doValidations.bind(this);
        this.selectInputText = this.selectInputText.bind(this);
        this.elementClick = this.elementClick.bind(this);
        this.commit = this.commit.bind(this);
        this.makeClassString = this.makeClassString.bind(this);

        if (!this.props.propName) throw "RTFM: missing 'propName' prop";
        if (!this.props.change) throw "RTFM: missing 'change' prop";
        if (this.props.value == undefined) throw "RTFM: missing 'value' prop";

        this.state = {
            editing: false,
            loading: false,
            disabled: false,
            invalid: false,
            newValue: ""
        };
    }

    doValidations(value) {
        if (this.props.validate) {
            this.setState({ invalid: !this.props.validate(value) });
        }
    };

    selectInputText(element) {
        if (element.setSelectionRange) element.setSelectionRange(0, element.value.length);
    };

    elementClick(event) {
        console.log("RIEBase must be subclassed first: use a concrete class like RIEInput, RIEToggle, RIEDate et.c");
    };

    componentWillReceiveProps(nextProps) {
        if ('value' in nextProps) this.setState({ loading: false, editing: false, invalid: false, newValue: null });
    }

    commit(value) {
        if (!this.state.invalid) {
            let newProp = {};
            newProp[this.props.propName] = value;
            this.setState({ loading: true, newValue: value });
            this.props.change(newProp);
        }
    };

    makeClassString() {
        var classNames = [];
        if (this.props.className) classNames.push(this.props.className);
        if (this.state.editing && this.props.classEditing) classNames.push(this.props.classEditing);
        if (this.state.loading && this.props.classLoading) classNames.push(this.props.classLoading);
        if (this.state.disabled && this.props.classDisabled) classNames.push(this.props.classDisabled);
        if (this.state.invalid && this.props.classInvalid) classNames.push(this.props.classInvalid);
        return classNames.join(' ');
    };

    render() {
        return <span {...this.props.defaultProps} tabIndex={0} className={this.makeClassString()} onClick={this.elementClick}>{this.props.value}</span>;
    };
}