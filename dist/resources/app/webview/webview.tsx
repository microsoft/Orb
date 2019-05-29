//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
// The MIT License (MIT)
// Copyright (c) 2016 Samuel Attard
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// This is a fork from https://github.com/MarshallOfSound/react-electron-web-view

import * as React from 'react';
import * as ReactDOM from 'react-dom';
const camelCase = require('lodash.camelcase');
import { changableProps, events, methods, props } from './constants';
declare var PropTypes;

export class WebView extends React.Component<props, any> {
    c;
    view;
    ready;
    setDevTools;
    isDevToolsOpened;
    openDevTools;
    closeDevTools;

    componentDidMount() {
        const container = ReactDOM.findDOMNode(this.c);
        let propString = '';
        Object.keys(this.props).forEach((propName) => {
            if (typeof this.props[propName] !== 'undefined') {
                if (typeof this.props[propName] === 'boolean') {
                    propString += `${propName}="${this.props[propName] ? 'on' : 'off'}" `;
                } else if (typeof this.props[propName] === 'string') {
                    propString += `${propName}="${this.props[propName]}" `;
                } else {
                    propString += `${propName}=${JSON.stringify(this.props[propName].toString())} `;
                }
            }
        });
        if (this.props.className) {
            propString += `class="${this.props.className}" `;
        }
        container.innerHTML = `<webview ${propString}/>`;
        this.view = container.querySelector('webview');

        this.ready = false;
        this.view.addEventListener('did-attach', (...attachArgs) => {
            this.ready = true;
            events.forEach((event) => {
                this.view.addEventListener(event, (...eventArgs) => {
                    const propName = camelCase(`on-${event}`);
                    if (this.props[propName]) this.props[propName](...eventArgs);
                });
            });
            if (this.props.onDidAttach) this.props.onDidAttach(...attachArgs);
        });

        methods.forEach((method) => {
            this[method] = (...args) => {
                if (!this.ready) {
                    // throw new Error('WebView is not ready yet, you can\'t call this method');
                }
                return this.view[method](...args);
            };
        });
        this.setDevTools = (open) => {
            if (open && !this.isDevToolsOpened()) {
                this.openDevTools();
            } else if (!open && this.isDevToolsOpened()) {
                this.closeDevTools();
            }
        };
    }

    componentDidUpdate(prevProps) {
        Object.keys(changableProps).forEach((propName) => {
            if (this.props[propName] !== prevProps[propName]) {
                if (changableProps[propName] === '__USE_ATTR__') {
                    this.view.setAttribute(propName, this.props[propName]);
                } else {
                    this[changableProps[propName]](this.props[propName]);
                }
            }
        });
    }

    isReady() {
        return this.ready;
    }

    render() {
        return <div ref={(c) => { this.c = c; }} style={this.props.style || {}} />;
    }
}