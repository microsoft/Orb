# Orb

* [Quick Start](#quick-start)

* [Resource Types](#resource-type-examples)

* [Adding Objects and Resources](models.md)

* [File Format](fileFormat.md)

* [Link Support](linkSupport.md)

* [Terminal Management](terminal.md)

* [Architecture](architecture.md)

* [Support](#support)

# Release Notes

# Quick Start

Orb is a web browser, built specifically for LiveSite and DevOps. It combines Kusto - Azure Data Explorer, PowerShell and a lot more.

> To get started, find an object in the Search View.

> Once a matching result is found, clicking on it takes you to the Explorer View.

> You can click on Resources in the Explorer View and begin exploring!

## Objects
> Objects are the primary entry point used for exploration.

> Objects contain a tree of Resources that you can interact with in the Explorer view.

To find an object, use the Search view from the Nav Bar on the left.

## Resources
> The simplest example of a resource is a web link.

> Every resource belongs to a parent object and is related to it in some way.

Resources are defined by stripping out parts of the resource that contain object specific context like the Object Id.

For example,

*An Azure Virtual Machine Object can have a Resource that is a link to Events for that specific Virtual Machine.*

Let's say that the following link shows you Virtual Machine Events for a VM with id "bar":

<pre>
https://vmEvents.azurewebsite.net?vmId=bar
</pre>

A resource definition for the above would look like this:

<pre>
https://vmEvents.azurewebsite.net?vmId={vmId}
</pre>

Note that "bar" has been replaced with "{vmId}" in the resource definition. This allows the link to be auto-populated with the right VM Id based on the context.

For a full list of supported Resource Types, see [this section.](#supported-resource-types)

## Context

> Every object in the Explorer view has context associated with it.

> This context is used to convert a generic resource definition to a concrete resource.

In the example above, if VM "bar" is selected in Explorer, "{vmId}" will automatically be replaced in all resource definitions.


## Associations

> Related objects are joined together through associations.

> Navigating to a related object generates a resource tree for that object in Explorer.

For example, an Azure VM is related to a Subscription. If VM "bar" is selected in Explorer, its Subscription Id and the entire resource tree for that Subscription can be browsed in Explorer.

At the moment, Kusto/PowerShell associations are supported. Relationship between objects must be expressed through Kusto queries/PowerShell script.

## Resource Type Examples

Each of the resource types below have specific resource handlers that automatically contextualize the resource based on the object context.

Resource Extension | Description
------------ | -------------
.link | General purpose contextual web link.
.kusto | Kusto query. By default, queries are opened in Kusto Explorer.
.psx | PowerShell scripts that are opened in an external PowerShell window.
.terminal | PowerShell scripts that are opened in Orb terminals.
.psmd | PowerShell scripts that are rendered as markdown pages.


## Adding Objects and Resources

To add resources or objects, see the model documentation [here.](models.md)

# Wiki

<a href= "https://github.com/Microsoft/Orb/README.md" target="_blank">https://github.com/Microsoft/Orb/README.md</a>

# Support

Please email [orbTalk](mailto:orbTalk@microsoft.com) for support.

For suggesting features use: <a href= "https://github.com/Microsoft/Orb/issues" target="_blank">https://github.com/Microsoft/Orb/issues</a>