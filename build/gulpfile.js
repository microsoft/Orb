//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

var gulp = require("gulp");
var gutil = require("gulp-util");
var argv = require("yargs").argv;
var rename = require("gulp-rename");
var path = require("path");
var ts = require("gulp-typescript");
var sourcemaps = require("gulp-sourcemaps");
var Q = require("q");
var fs = require("fs");
var rcedit = require("rcedit");
var electronInstaller = require("electron-winstaller");
var del = require("del");
var spawnSync = require("child_process").spawnSync;
var Msbuild = require("msbuild");

var paths = {
    electron: [path.join(argv.sourceFolder, "node_modules/electron/dist/**/*"), "!" + path.join(argv.sourceFolder, "/**/default_app.asar"), "!" + path.join(argv.sourceFolder, "/**/electron.exe")],
    electronExe: [path.join(argv.sourceFolder, "node_modules/electron/dist/electron.exe")],
    updateExe: [path.join(argv.sourceFolder, "node_modules/electron-winstaller/vendor/update.exe")],
    winstaller: path.join(argv.sourceFolder, "node_modules/electron-winstaller/"),
    assets: path.join(argv.sourceFolder, "assets"),
    dist: argv.outputFolder,
    app: path.join(argv.outputFolder, "resources/app"),
    installer: !isSaw() ? path.join(argv.sourceFolder, "installer") : path.join(argv.sourceFolder, "installer_saw"),
    build: path.join(argv.sourceFolder, "build"),
    stubexe: path.join(argv.outputFolder, "" + getStubExeName()),
    originalStubExe: path.join(argv.sourceFolder, "node_modules/electron-winstaller/vendor/StubExecutable.exe")
}

gulp.task("copyElectron", function () {
    gutil.log("Destination folder: " + paths.dist);
    gutil.log("Source folder: " + paths.electron);
    gutil.log("Copying electron dependencies.");
    return gulp.src(paths.electron)
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
    gutil.log("Running on branch " + argv.buildBranch || "local");
    if (argv.buildBranch && argv.buildBranch.toLowerCase() === "insiders") {
        exeName = "orb_insiders.exe";
    }
    return exeName;
}

function isSaw() {
    return argv.outputFolder.toLowerCase().indexOf("_saw") > 0;
}

function getStubExeName() {
    return getExeName().replace(".exe", "") + ".ExecutionStub.exe";
}

function getBuildVersion() {
    var buildVersion = "1.0.0";

    if (argv.buildVersion) {
        buildVersion = argv.buildVersion
    }

    gutil.log("Running on buildVersion " + buildVersion);
    return buildVersion;
}

gulp.task("copyStubExe", function () {

    // The stub exe is package with squirrel 1.5+ (electron-winstaller)
    // The stub provides a way to launch the latest version. This is required for file associations (.orb files) to not break after updates.
    // It needs to be dropped in the top level install folder after signing, etc.
    // Squirrel 1.5+ does this automatically, however, since the squirrel does the stub file generation for you as part of creating the installer,
    // this leaves the stub exe unsigned (since signing is not done by squirrel but by ESRP and we can't provide the signing cert/password directly to squirrel).
    // As a workaround, create the stub manually by copying it in the dist folder and delete the original squirrel stub so squirrel skips this step for us.
    // We also need to delete the original tool that copies over exe attributes, since this reverses the signing process.
    // Replace it with a custom version that bypasses stub signing only.
    // This is forked from: https://github.com/Squirrel/Squirrel.Windows/tree/master/src/WriteZipToSetup
    // The fork code is not committed, but pasted here for reference.
    // int wmain(int argc, wchar_t* argv[])
    // {
    //  if (argc > 1 && wcscmp(argv[1], L"--copy-stub-resources") == 0) {
    // 	return 0;		}
    //
    //
    gutil.log("Copying stub exe to " + paths.stubexe);
    return gulp.src(paths.winstaller + "/vendor/StubExecutable.exe")
        .pipe(rename(getStubExeName()))
        .pipe(gulp.dest(paths.dist));
});

gulp.task("resEditStubExe", gulp.series("copyStubExe", function (done) {
    var deferred = Q.defer();

    var exeName = getExeName();

    if (exeName !== "orb_insiders.exe") {
        console.log("resEdit for prod version.");
        rcedit(paths.stubexe, {
            "name": "Orb",
            "icon": paths.assets + "/orb.ico"
            // this is failing for the stub for some reason, so comment out for now.
            // "version-string": {
            // 	"ProductName": "Orb",
            // 	"FileDescription": "Orb",
            // 	CompanyName: "Microsoft",
            // 	LegalCopyright: "Microsoft",
            // },
            // "product-version": getBuildVersion()
        }, function (err) {
            if (!err) {
                deferred.resolve();
            } else {
                gutil.log(err.toString());
                done(err.toString());
            }
        });
    } else {

        rcedit(paths.stubexe, {
            "name": "Orb Insiders",
            "icon": paths.assets + "/orb_insiders.ico"
            // this is failing for the stub for some reason, so comment out for now.
            // "version-string": {
            // 	"ProductName": "Orb Insiders",
            // 	"FileDescription": "Orb Insiders",
            // 	CompanyName: "Microsoft",
            // 	LegalCopyright: "Microsoft",
            // },
            // "product-version": getBuildVersion()
        }, function (err) {
            if (!err) {
                deferred.resolve();
            } else {
                gutil.log(err.toString());
                done(err.toString());
            }
        });
    }

    return deferred.promise;
}));

gulp.task("deleteOriginalZipToSetup", function () {
    var zipToSetupPath = path.join(paths.winstaller + "/vendor/WriteZipToSetup.exe");

    gutil.log("Deleting " + zipToSetupPath);
    return del([
        zipToSetupPath
    ], { force: true });
});

gulp.task("copyForkedZipToSetup", gulp.series("deleteOriginalZipToSetup", function () {

    // We can't delete WriteZipToSetup.exe since squirrel fails releasify without it.
    // Just copy the same stub executable and rename it to WriteSetupToZip to keep squirrel happy.
    gutil.log("Override WriteZipToSetup.exe");
    return gulp.src(path.join(paths.assets, "/WriteZipToSetup_Forked.exe"))
        .pipe(rename("WriteZipToSetup.exe"))
        .pipe(gulp.dest(path.join(paths.winstaller, "/vendor/")));
}));

gulp.task("deleteOriginalStubExecutable", gulp.series("copyForkedZipToSetup", function () {
    gutil.log("Deleting " + paths.originalStubExe);

    return del([
        paths.originalStubExe
    ], { force: true });
}));

gulp.task("renameUpdateExe", function () {
    gutil.log("Copying update exe and renaming to squirrel.exe");
    return gulp.src(paths.updateExe)
        .pipe(rename("squirrel.exe"))
        .pipe(gulp.dest(paths.dist));
});

gulp.task("resEdit", gulp.series("renameElectronExe", "renameUpdateExe", function (done) {
    var deferred = Q.defer();

    var exeName = getExeName();

    if (exeName !== "orb_insiders.exe") {
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
                done(err.toString());
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
                done(err.toString());
            }
        });

    }

    return deferred.promise;
}));

gulp.task("copyNuspec", function () {
    gutil.log("Copying custom nuspec template.");
    return gulp.src(paths.build + "/template.nuspectemplate")
        .pipe(gulp.dest(paths.winstaller));
});

gulp.task("createInstaller", gulp.series("copyNuspec", "deleteOriginalStubExecutable", function () {
    gutil.log("Creating Installer at " + paths.installer);

    var exeName = getExeName();
    console.log(paths);
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
            noMsi: true,
            noDelta: true
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
            noMsi: true,
            noDelta: true
        });
    }
}));

gulp.task("transpile", function () {
    var tsProject = ts.createProject(paths.app + "/tsconfig.json");
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(paths.app));
});

gulp.task("installDependencies", function (done) {
    gutil.log("Install Dependencies");
    gutil.log("npm.cmd", ["install"], { cwd: argv.sourceFolder, stdio: ["inherit", "inherit", "inherit"] });
    var res = null;

    res = spawnSync("npm.cmd", ["install"], { cwd: argv.sourceFolder, stdio: ["inherit", "inherit", "inherit"] });
    if (res.error) {
        throw "Failed to install dev dependencies";
    }

    gutil.log("npm.cmd", ["install"], { cwd: paths.app, stdio: ["inherit", "inherit", "inherit"] });
    res = spawnSync("npm.cmd", ["install"], { cwd: paths.app, stdio: ["inherit", "inherit", "inherit"] });

    if (res.error) {
        throw "Failed to install app dependencies";
    }

    gutil.log("npm.cmd", ["install"], { cwd: path.join(argv.sourceFolder, "node_modules_native"), stdio: ["inherit", "inherit", "inherit"] });
    spawnSync("npm.cmd", ["install"], { cwd: path.join(argv.sourceFolder, "node_modules_native"), stdio: ["inherit", "inherit", "inherit"] });

    if (res.error) {
        throw "Failed to install native dependencies";
    }

    gutil.log("powershell.exe", ["-File", path.join(argv.sourceFolder, "node_modules_native", "buildNativeDependencies.ps1")], { stdio: ["inherit", "inherit", "inherit"] });
    spawnSync("powershell.exe", ["-File", path.join(argv.sourceFolder, "node_modules_native", "buildNativeDependencies.ps1")], { stdio: ["inherit", "inherit", "inherit"] });

    if (res.error) {
        throw "Failed to compile native dependencies";
    }

    done();
})

gulp.task("buildDotNetDependencies", function (done) {
    gutil.log("nuget.exe", ["restore"], { cwd: path.join(argv.sourceFolder, "dotNet"), stdio: ["inherit", "inherit", "inherit"] });
    var res = spawnSync("nuget.exe", ["restore"], { cwd: path.join(argv.sourceFolder, "dotNet"), stdio: ["inherit", "inherit", "inherit"] });
    if (res.error) {
        throw "Failed to restore dotNet packages";
    }

    gutil.log("msbuild.exe", ["Orb.sln"], { cwd: path.join(argv.sourceFolder, "dotNet"), stdio: ["inherit", "inherit", "inherit"] });

    var build = new Msbuild();
    build.sourcePath = path.join(argv.sourceFolder, "dotNet", "Orb.sln");
    build.build();

    build.on("done", function (err, results) {
        if (err) {
            gutil.log("err");
        }

        done();
    })
})

gulp.task("runTests", gulp.series("installDependencies", "copyElectron", "resEdit", "resEditStubExe", "transpile", "buildDotNetDependencies", function (done) {
    gutil.log("Run tests");
    var res = spawnSync("npm.cmd", ["test"], { cwd: paths.app, stdio: ["inherit", "inherit", "inherit"] });
    if (res.error) {
        throw "Failed to run tests";
    }

    done();
}));

if (!argv.buildBranch) {
    gulp.task("build", gulp.series("runTests", function (done) {
        gutil.log("Building Orb");
        done();
    }));
} else {
    gulp.task("build", gulp.series("copyElectron", "resEdit", "resEditStubExe", "transpile", function (done) {
        gutil.log("Building Orb");
        done();
    }));
}

