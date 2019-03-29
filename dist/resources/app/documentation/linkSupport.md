# Link Support

* [Back to Help](all.md)

Orb allows you to save all state in a link and share that with others.

Orb links use the same schema as the [File Format](fileFormat.md).

> You can copy the link by File -> Copy Link or Ctrl + L.

## Sample Orb Link

```
orbx://new/H4sIAAAAAAAAA12QwQqDMAyG7z6F9LzDhrfdRBjsMBDW27pD1TA7tO1iHQ7x3ddW...?overrides={'property': 'value'}
```

When the link is pasted as HTML, there are three options visible:

```
[Run in New Orb Instance][Run in Default Orb Instance][Install Orb]
```

## Instance
```
orbx://{instance}/{data}?overrides={parameters}
```

The field {instance} controls launch behavior. Three launch modes are available:

> * new - Launch a new instance of Orb and apply state. If no instance is specified, this mode is selected.
> * default - Launch a new instance only if there is no running instance. Otherwise *append* state to the first opened Orb instance (the default instance).
> * {Guid} - Append state to a specific instance provided by the Guid. This is useful for terminal interaction purposes. See example below.

The {data} is the file format, Gzipped, Base64 and then url encoded.

The {parameters} section defines what values can be overridden in the URL.

* [File Format](fileFormat.md)