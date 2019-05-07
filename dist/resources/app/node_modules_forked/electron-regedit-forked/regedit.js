const { app } = require('electron');
const Q = require('q')
const debug = require('./debug')

function Regedit() {

}

Regedit.progIds = []

Regedit.add = function(progid) {
    Regedit.progIds.push(progid)
}

Regedit.installAll = function() {
    return Q.all(Regedit.progIds.map(progId => progId.install()))
}

Regedit.uninstallAll = function() {
    return Q.all(Regedit.progIds.map(progId => progId.uninstall()))
}

Regedit.squirrelStartupEvent = function() {
    if (process.platform !== 'win32') {
        return false;
    }

    var squirrelCommand = process.argv[1];
    switch (squirrelCommand) {
        case '--squirrel-install':
        case '--squirrel-updated':
            debug('Squirrel install/update')
            Regedit.installAll().finally(() => app.quit())
            return true;
        case '--squirrel-uninstall':
            debug('Squirrel uninstall')
            Regedit.uninstallAll().finally(() => app.quit())
            return true;
            debug('Squirrel obsolete')
        case '--squirrel-obsolete':
            app.quit();
            return true;
    }
}

module.exports = Regedit