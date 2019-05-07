const Registry = require('winreg')
const path = require('path')
const {app} = require('electron')

const {$create, $set} = require('./util')

function ShellOption({
    verb = 'open',
    action = undefined,
    icon = undefined,
    args = ["%1"],
    friendlyAppName = undefined,
    selected = false,
    squirrel = false,
    command = undefined
}) {
    this.verb = verb
    this.action = action
    this.selected = selected
    this.friendlyAppName = friendlyAppName
    this.icon = icon
    this.args = args
    this.squirrel = squirrel
    this.command = command
}

ShellOption.OPEN = 'open'
ShellOption.OPEN_NEW = 'opennew'
ShellOption.PRINT = 'print'
ShellOption.EXPLORE = 'explore'
ShellOption.FIND = 'find'
ShellOption.OPEN_AS = 'openas'
ShellOption.PROPERTIES = 'properties'
ShellOption.EDIT = 'edit'
ShellOption.PREVIEW = 'preview'

ShellOption.prototype.bindProg = function (progid) {
    this.progid = progid
    if (this.squirrel === undefined) this.squirrel = this.progid.squirrel
    if (this.friendlyAppName === undefined) this.friendlyAppName = this.progid.friendlyAppName
    if (this.squirrel) this.args.unshift('--process-start-args')

    return this
};

ShellOption.prototype.install = function () {
    if (!this.progid) {
        throw new Error('ShellOption must be part of a ProgId')
        return
    }

    let self = this

    let registry = new Registry({
        hive: this.progid.hive,
        key: `${this.progid.BASE_KEY}\\shell\\${this.verb}\\command`
    })

    return $create(registry)
        .then(() => registerCommand(registry))
        .then(() => registerAction(registry.parent))
        .then(() => registerIcon(registry.parent))
        .then(() => registerFriendlyAppName(registry.parent))
        .then(() => registerSelected(registry.parent.parent))


    function registerCommand(registry) {
        if (!self.command) {
            if (self.squirrel) {
                let exec = self.squirrel === true ? `${app.getName()}.exe` : self.squirrel
                self.command = path.join(path.dirname(process.execPath), '..', exec)
            } else {
                self.command = process.execPath
            }
        }
        let command = [`"${self.command}"`].concat(self.args.map((arg) => `"${arg}"`))
        return $set(registry, Registry.DEFAULT_VALUE, Registry.REG_SZ, command.join(' '))
    }

    function registerAction(registry) {
        if (self.action === undefined && self.verb === 'open') {
            self.action = `Open with ${self.progid.appName}`
        }

        if (!self.action) return

        return $set(registry, Registry.DEFAULT_VALUE, Registry.REG_SZ, self.action)
    }

    function registerIcon(registry) {
        if (!self.icon) return

        let iconPath
        if (path.isAbsolute(self.icon)) {
            iconPath = self.icon
        } else {
            iconPath = path.join(process.execPath, '..', self.icon)
        }

        return $set(registry, 'Icon', Registry.REG_SZ, iconPath)
    }

    function registerSelected(registry) {
        if (self.selected !== true) return

        return $set(registry, Registry.DEFAULT_VALUE, Registry.REG_SZ, self.verb)
    }

    function registerFriendlyAppName(registry) {
        const KEY = 'FriendlyAppName'

        if (self.friendlyAppName) {
            if (self.friendlyAppName === true) self.friendlyAppName = app.getName()
            return $set(registry, KEY, Registry.REG_SZ, self.friendlyAppName)
        }
    }
};

module.exports = ShellOption