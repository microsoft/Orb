var gulp = require("gulp");
var gutil = require("gulp-util");
var argv = require('yargs').argv;
var rename = require("gulp-rename");
var path = require ('path');

var paths = {
	electron: ["node_modules/electron/dist/**/*", "!/**/electron.exe"],
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

gulp.task("build", ["copyElectron", "renameElectronExe"], function (callback) {
	gutil.log("Building Orb");
});