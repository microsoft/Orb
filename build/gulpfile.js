var gulp = require("gulp");
var gutil = require("gulp-util");
var argv = require('yargs').argv;
var rename = require("gulp-rename");
var path = require('path');
var glob = require("glob");
var ts = require("gulp-typescript");
var sourcemaps = require("gulp-sourcemaps");
var Q = require("q");
var fs = require("fs");
var rcedit = require("rcedit");
var electronInstaller = require("electron-winstaller");

var paths = {
    electron: [path.join(argv.sourceFolder, "/node_modules/electron/dist/**/*"), "!" + path.join(argv.sourceFolder, "/**/default_app.asar"), "!" + path.join(argv.sourceFolder, "/**/electron.exe")],
    electronExe: [path.join(argv.sourceFolder, "node_modules/electron/dist/electron.exe")],
    updateExe: [path.join(argv.sourceFolder, "/node_modules/electron-winstaller/vendor/update.exe")],
    winstaller: path.join(argv.sourceFolder, "node_modules/electron-winstaller/"),
    assets: path.join(argv.sourceFolder, "assets"),
    dist: path.join(argv.outputFolder, "/dist"),
    app: path.join(argv.sourceFolder, "dist/resources/app"),
    installer: path.join(argv.sourceFolder, "/installer"),
    build: path.join(argv.sourceFolder, "/build")
}

gulp.task("copyElectron", function () {
    gutil.log("Destination folder: " + paths.dist);
    gutil.log("Source folder: " + paths.electron);
    gutil.log("Copying electron dependencies.");
    return gulp.src(paths.electron)
        .pipe(gulp.dest(paths.dist));
});

gulp.task("copyOtherSourceFiles", function () {
    gutil.log("Copying other source files")
    return gulp.src(path.join(argv.sourceFolder, "/thirdPartyNotice.txt"))
        .pipe(gulp.dest(paths.dist));
});

gulp.task("renameElectronExe", function () {

    var exeName = getExeName();
    gutil.log("Copying electron exe and renaming to " + exeName);
    return gulp.src(paths.electronExe)
        .pipe(rename(exeName))
        .pipe(gulp.dest(paths.dist));
});

function getExeName() {
    var exeName = "orb.exe";
    gutil.log("Running on branch " + argv.buildBranch);
    if (argv.buildBranch.toLowerCase() === "insiders") {
        exeName = "orb_insiders.exe";
    }
    return exeName;
}

function getBuildVersion() {
    if (argv.buildVersion) {
        return argv.buildVersion
    }

    return "1.0.0";
}


function dumpFiles(input) {
    gutil.log("Dumping " + input);
    glob(input, {}, function (er, files) {
        files.forEach(function (f) {
            gutil.log(f);
        })
    })
}

gulp.task("renameUpdateExe", function () {
    gutil.log("Copying update exe and renaming to squirrel.exe");
    return gulp.src(paths.updateExe)
        .pipe(rename("squirrel.exe"))
        .pipe(gulp.dest(paths.dist));
});

gulp.task("resEdit", ["renameElectronExe", "renameUpdateExe"], function (callback) {
    var deferred = Q.defer();

    var exeName = getExeName();

    if (exeName !== "orb_insiders.exe") {
        console.log("resEdit for prod version.");
        rcedit(paths.dist + "/" + exeName, {
            "name": "Orb",
            "icon": paths.assets + "/orb.ico",
            "version-string": {
                "ProductName": "Orb",
                "FileDescription": "Orb",
                CompanyName: "Microsoft",
                LegalCopyright: "Microsoft",
            },
            "product-version": getBuildVersion()
        }, function (err) {
            if (!err) {
                deferred.resolve();
            } else {
                gutil.log(err.toString());
                callback(err.toString());
            }
        });
    } else {
        console.log("Modifying package.json");
        var package = JSON.parse(fs.readFileSync(paths.app + "/package.json", "utf8"));
        if (!package) {
            deferred.reject("Package.json not parsed");
        }

        package.name = "OrbInsiders";
        package.description = "Orb Insiders";

        fs.writeFileSync(paths.app + "/package.json", JSON.stringify(package), "utf8");

        console.log("resEdit for insiders version.");
        rcedit(paths.dist + "/" + exeName, {
            "name": "Orb Insiders",
            "icon": paths.assets + "/orb_insiders.ico",
            "version-string": {
                "ProductName": "Orb Insiders",
                "FileDescription": "Orb Insiders",
                CompanyName: "Microsoft",
                LegalCopyright: "Microsoft",
            },
            "product-version": getBuildVersion()
        }, function (err) {
            if (!err) {
                deferred.resolve();
            } else {
                gutil.log(err.toString());
                callback(err.toString());
            }
        });

    }

    return deferred.promise;
});

gulp.task("copyNuspec", function () {
    gutil.log("Copying custom nuspec template.");
    return gulp.src(paths.build + "/template.nuspectemplate")
        .pipe(gulp.dest(paths.winstaller));
});

gulp.task("createInstaller", ["copyOtherSourceFiles", "copyNuspec"], function () {
    gutil.log("Creating Installer at " + paths.installer);
    var exeName = getExeName();

    if (exeName !== "orb_insiders.exe") {
        return electronInstaller.createWindowsInstaller({
            appDirectory: paths.dist,
            outputDirectory: paths.installer,
            authors: "Microsoft",
            owners: "Microsoft",
            exe: exeName,
            version: getBuildVersion(),
            loadingGif: paths.assets + "/orbInstall.gif",
            setupIcon: paths.assets + "/orb.ico",
            noMsi: true
        });
    } else {
        return electronInstaller.createWindowsInstaller({
            name: "OrbInsiders",
            id: "OrbInsiders",
            title: "Orb - Insiders",
            productName: "OrbInsiders",
            appDirectory: paths.dist,
            outputDirectory: paths.installer,
            authors: "Microsoft",
            owners: "Microsoft",
            exe: exeName,
            version: getBuildVersion(),
            loadingGif: paths.assets + "/orbInsidersInstall.gif",
            setupIcon: paths.assets + "/orb_insiders.ico",
            noMsi: true
        });
    }
});

gulp.task("transpile", function () {
    var tsProject = ts.createProject(paths.app + "/tsconfig.json");
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(paths.app));
});

gulp.task("build", ["copyElectron", "resEdit", "transpile"], function (callback) {
    gutil.log("Building Orb");
});