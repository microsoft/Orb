# Link Support

Orb allows you to save all state in a link and share that with others.

Orb links use the same schema as the [File Format](fileFormat.md).

> You can copy the link by File -> Copy Link or Ctrl + L.

## Sample Orb Link

```
orbx://new/H4sIAAAAAAAAA8VTQU%2FDIBS%2B71csnCUpg67Uo170MF102UV2gPLmputA2hnN0v8utE1jFzVxLpEDfIGP99735b39YOgXKkC6bHUjcyiszACdD9GtU%2FcytxtAZw0H3uzGOHAzB1B4xkN9Hda%2BQzXRqCfIymvdiyLEpcntrvTgyhSlEJJqIlPGcUwlYEaSGPOIRlgnmiQsYyN%2Ftqm7yNufCjzIP5XlKtB6aQ%2BpDl52awd66owNmvpKakr41mjZN7BCPVL1TcgLWUAXthp8Qf%2BlbXcyexZilLKE64h5xxT3m6ZYpUAw4SSBWC31OFUntS2kPcK28K21rYH%2FZdt8IgRdxsmY%2B%2BYaab7EjBOFOfOtpzIZj0mURpyettfmkyMsm09awwL4o101WrSTayxsZ1LVQ7s4nOZ1Dr1yUPlua80ONrJcv36WjOSjCU800k151aD6AMNbzTlCBAAA?overrides={'HostId':'a3d1a948-53ae-4175-8030-d7d174c427d1','RackId':'29478d04-41b8-41d3-b9e1-1817e5bfd69b','VMId':'3f576830-2d8f-481b-8448-bca561090831'}
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

