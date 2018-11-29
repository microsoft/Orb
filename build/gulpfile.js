var gulp = require("gulp");
var gutil = require("gulp-util");
var argv = require('yargs').argv;
var rename = require("gulp-rename");
var path = require ('path');
var glob = require("glob");

var paths = {
	electron: [path.join(argv.outputFolder, "/node_modules/electron/dist/**/*")],
	electronExe: ["node_modules/electron/dist/electron.exe"],
	updateExe: ["node_modules/electron-winstaller/vendor/update.exe"],
	winstaller: "node_modules/electron-winstaller/",
	assets: "assets",
	dist: path.join(argv.outputFolder,"/dist"),
	app: "dist/resources/app",
	build: "build"
}

gulp.task("copyElectron", function () {
    gutil.log("Destination folder: " + paths.dist);
    gutil.log("Source folder: " + paths.electron);
    dumpFiles(paths.electron[0]);
    dumpFiles(paths.dist);
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
    gutil.log("Running on branch " + argv.buildBranch);
    return exeName;
}

function dumpFiles(input) {
    gutil.log("Dumping " + input);
    glob(input, {}, function (er, files) {
        files.forEach(function(f){
            gutil.log(f);
        })
      })
}

gulp.task("build", ["copyElectron", "renameElectronExe"], function (callback) {
	gutil.log("Building Orb");
});