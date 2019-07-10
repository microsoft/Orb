![](https://img.shields.io/badge/node-8.15.0-blue.svg)
![](https://img.shields.io/badge/electron-2.0.9-blue.svg)
![](https://img.shields.io/badge/typescript-2.5.3-blue.svg)
![](https://img.shields.io/badge/platform-win--64%20%7C%20win--32-success.svg)

[![Build Status](https://dev.azure.com/orbPipeline/Orb/_apis/build/status/Microsoft.Orb?branchName=master)](https://dev.azure.com/orbPipeline/Orb/_build/latest?definitionId=1&branchName=master)

Orb is a tool built specifically for running Live Site for your services.

# Installation
Download the latest installer from the [releases page.](https://github.com/microsoft/Orb/releases)

# Features
## Object and Context Driven
Orb allows you to rapidly browse through information based on an object hierarchy. 

When any resource on the object tree is clicked, all context associated with that object is passed to the resource link.
This allows you to rapidly explore shared queries, dashboards, links, scripts and more since all variables are automatically injected for you.

![](gifs/ObjectAndContextDriven.gif)

## Backed by Azure Data Explorer
Object heirarchies are user defined and backed by ADX queries. ADX integration allows rapidly searching for objects and discovering hierarchies dynamically.

![](gifs/BackedByKusto.gif)

## Extensible and Shareable
All object definitions and hierarchies are defined as JSON config. You can edit object definitions, add resources and share your changes from within Orb.

These config files are stored on a Git repository - this provides a shared view of Live Site resources across the entire organization.

![](gifs/ExtensibleAndShareable.gif)
## PowerShell Support
Orb allows you to save and share PowerShell snippets. The results of these PowerShell snippets are displayed as web pages rendered using Markdown.

Since Orb allows multiple tabs, you can open up saved snippets and run them in parallel. Reloading (F5) these PowerShell pages re-executes the PowerShell script. Ctrl+F searches through result output.

![](gifs/PowerShellSupport.gif)
# Terminal Integration
In addition to PowerShell Markdown support, you can open a fully functional PowerShell terminal in Orb.
You can define custom terminal profiles to launch terminals with custom startup scripts.

![](gifs/TerminalIntegration.gif)
# Orb Files and Links
You can save Orb state to a file, edit it, pin it to your JumpList to accelerate repeated workflows.

You can also share your Orb state as a link.

# Built On Electron
Orb is built on [Electron](https://electronjs.org/).

Every tab in Orb is a Chromium process.

# [Onboarding](ONBOARDING.md)

# [Contributing](CONTRIBUTING.md)

