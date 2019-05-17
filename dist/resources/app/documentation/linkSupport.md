# Link Support

* [Back to Help](all.md)

Orb allows you to save all state in a link and share that with others.

Orb links use the same schema as the [File Format](fileFormat.md).

> You can copy the link by File -> Copy Link or Ctrl + L.

## Sample Orb Link

```
orbx://new/H4sIAAAAAAAAA7WTwU%2FCMBjF7%2F4VpGeadKV0xasnDyBRwsVx%2BNp%2BE5TRWobRkP3vrttCHIkeCPawvG2vfXu%2F7DveDOpF9gjBrGdQ4N6DQXI7IA9BP0Hht0iGrQc%2F%2FdYFDIuAuK8dz83juI4n1RidfkVT3tveKVl25wp%2FKGsxc7a%2BaoBcWzOmMkk4FToFqhOlKQKmSrCEGwVd9Onk3V8feJY%2Fh3Idbb3Yc2vA98MmoJ0H52OnfpPGEre1XY6trEjPVJ3uquGlRJbTLLP5xOZ8JCnnOVJhlaDKSE0FN9LKUcoEJlflsZxeQGM57VhE8Q8kHsG8ZZnMczmeGEuZlvW%2FkU4UBaYFFWacWsYNt0xdlUWMvYBG3NbxaOXvRBq16kbJedwtQDdTtDofr02BvTRSfvmmVMAtlJuPn50IvLj4asRsm1zdVN%2BTTi070wMAAA%3D%3D?overrides={'NodeId':'baafbdc5-6112-4b7a-b18b-eae784012c8a','VMId':'df9df236-22fe-4d84-8c6b-42c6d63704e1','RackId':'6ff659cd-0b62-4798-a0b4-4c57d02c2d08'}
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