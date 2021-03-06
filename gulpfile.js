'use strict';

const pkg = require('./package.json');

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const zip = require('gulp-zip');
const del = require('del');
const NwBuilder = require('nw-builder');
const makensis = require('makensis');
const deb = require('gulp-debian');

const gulp = require('gulp');
const concat = require('gulp-concat');
const install = require("gulp-install");
const rename = require('gulp-rename');
const os = require('os');

const DIST_DIR = './dist/';
const APPS_DIR = './apps/';
const DEBUG_DIR = './debug/';
const RELEASE_DIR = './release/';

var nwBuilderOptions = {
    version: '0.27.4',
    files: './dist/**/*',
    macIcns: './src/images/bf_icon.icns',
    macPlist: { 'CFBundleDisplayName': 'Betaflight Configurator'},
    winIco: './src/images/bf_icon.ico'
};

//-----------------
//Pre tasks operations
//-----------------
const SELECTED_PLATFORMS = getInputPlatforms();

//-----------------
//Tasks
//-----------------

gulp.task('clean', gulp.parallel(clean_dist, clean_apps, clean_debug, clean_release));

gulp.task('clean-dist', clean_dist);

gulp.task('clean-apps', clean_apps);

gulp.task('clean-debug', clean_debug);

gulp.task('clean-release', clean_release);

gulp.task('clean-cache', clean_cache);

var distBuild = gulp.series(clean_dist, dist_src, dist_locale, dist_libraries, dist_resources);
gulp.task('dist', distBuild);

var appsBuild = gulp.series(gulp.parallel(clean_apps, distBuild), apps, gulp.parallel(listPostBuildTasks(APPS_DIR)));
gulp.task('apps', appsBuild);

var debugBuild = gulp.series(gulp.parallel(clean_debug, distBuild), debug, gulp.parallel(listPostBuildTasks(DEBUG_DIR)), start_debug)
gulp.task('debug', debugBuild);

var releaseBuild = gulp.series(gulp.parallel(clean_release, appsBuild), gulp.parallel(listReleaseTasks()));
gulp.task('release', releaseBuild);

gulp.task('default', debugBuild);

// -----------------
// Helper functions
// -----------------

// Get platform from commandline args
// #
// # gulp <task> [<platform>]+        Run only for platform(s) (with <platform> one of --linux64, --linux32, --osx64, --win32, --win64, or --chromeos)
// # 
function getInputPlatforms() {
    var supportedPlatforms = ['linux64', 'linux32', 'osx64', 'win32','win64', 'chromeos'];
    var platforms = [];
    var regEx = /--(\w+)/;
    for (var i = 3; i < process.argv.length; i++) {
        var arg = process.argv[i].match(regEx)[1];
        if (supportedPlatforms.indexOf(arg) > -1) {
             platforms.push(arg);
        } else {
             console.log('Unknown platform: ' + arg);
             process.exit();
        }
    }  

    if (platforms.length === 0) {
        var defaultPlatform = getDefaultPlatform();
        if (supportedPlatforms.indexOf(defaultPlatform) > -1) {
            platforms.push(defaultPlatform);
        } else {
            console.error(`Your current platform (${os.platform()}) is not a supported build platform. Please specify platform to build for on the command line.`);
            process.exit();
        }
    }

    if (platforms.length > 0) {
        console.log('Building for platform(s): ' + platforms + '.');
    } else {
        console.error('No suitables platforms found.');
        process.exit();
    }

    return platforms;
}

// Gets the default platform to be used
function getDefaultPlatform() {
    var defaultPlatform;
    switch (os.platform()) {
    case 'darwin':
        defaultPlatform = 'osx64';

        break;
    case 'linux':
        defaultPlatform = 'linux64';

        break;
    case 'win32':
        defaultPlatform = 'win32';

        break;
        
    default:
        defaultPlatform = '';
    
        break;
    }
    return defaultPlatform;
}


function getPlatforms() {
    return SELECTED_PLATFORMS.slice();
}

function removeItem(platforms, item) {
    var index = platforms.indexOf(item);
    if (index >= 0) {
        platforms.splice(index, 1);
    }
}

function getRunDebugAppCommand(arch) {
    switch (arch) {
    case 'osx64':
        return 'open ' + path.join(DEBUG_DIR, pkg.name, arch, pkg.name + '.app');

        break;

    case 'linux64':
    case 'linux32':
        return path.join(DEBUG_DIR, pkg.name, arch, pkg.name);

        break;

    case 'win32':
    case 'win64':
        return path.join(DEBUG_DIR, pkg.name, arch, pkg.name + '.exe');

        break;

    default:
        return '';

        break;
    }
}

function getReleaseFilename(platform, ext) {
    return 'betaflight-configurator_' + pkg.version + '_' + platform + '.' + ext;
}

function clean_dist() { 
    return del([DIST_DIR + '**'], { force: true }); 
};

function clean_apps() { 
    return del([APPS_DIR + '**'], { force: true }); 
};

function clean_debug() { 
    return del([DEBUG_DIR + '**'], { force: true }); 
};

function clean_release() { 
    return del([RELEASE_DIR + '**'], { force: true }); 
};

function clean_cache() { 
    return del(['./cache/**'], { force: true }); 
};

// Real work for dist task. Done in another task to call it via
// run-sequence.
function dist_src() {
    var distSources = [
        // CSS files
        './src/css/main.css',
        './src/css/tabs/power.css',
        './src/css/tabs/firmware_flasher.css',
        './src/css/tabs/onboard_logging.css',
        './src/css/tabs/receiver.css',
        './src/css/tabs/cli.css',
        './src/css/tabs/servos.css',
        './src/css/tabs/adjustments.css',
        './src/css/tabs/configuration.css',
        './src/css/tabs/auxiliary.css',
        './src/css/tabs/pid_tuning.css',
        './src/css/tabs/transponder.css',
        './src/css/tabs/gps.css',
        './src/css/tabs/led_strip.css',
        './src/css/tabs/sensors.css',
        './src/css/tabs/osd.css',
        './src/css/tabs/motors.css',
        './src/css/tabs/receiver_msp.css',
        './src/css/tabs/logging.css',
        './src/css/tabs/landing.css',
        './src/css/tabs/setup_osd.css',
        './src/css/tabs/help.css',
        './src/css/tabs/failsafe.css',
        './src/css/tabs/ports.css',
        './src/css/tabs/setup.css',
        './src/css/opensans_webfontkit/fonts.css',
        './src/css/dropdown-lists/css/style_lists.css',
        './src/css/font-awesome/css/font-awesome.min.css',
        './src/css/font-awesome/fonts/*',
        './src/css/opensans_webfontkit/*.{eot,svg,ttf,woff,woff2}',

        // JS files
        './src/js/injected_methods.js',
        './src/js/data_storage.js',
        './src/js/workers/hex_parser.js',
        './src/js/fc.js',
        './src/js/port_handler.js',
        './src/js/port_usage.js',
        './src/js/serial.js',
        './src/js/gui.js',
        './src/js/huffman.js',
        './src/js/default_huffman_tree.js',
        './src/js/model.js',
        './src/js/serial_backend.js',
        './src/js/msp/MSPCodes.js',
        './src/js/msp.js',
        './src/js/msp/MSPHelper.js',
        './src/js/backup_restore.js',
        './src/js/peripherals.js',
        './src/js/protocols/stm32.js',
        './src/js/protocols/stm32usbdfu.js',
        './src/js/localization.js',
        './src/js/boards.js',
        './src/js/RateCurve.js',
        './src/js/Features.js',
        './src/js/Beepers.js',
        './src/js/release_checker.js',
        './src/js/tabs/adjustments.js',
        './src/js/tabs/auxiliary.js',
        './src/js/tabs/cli.js',
        './src/js/tabs/configuration.js',
        './src/js/tabs/failsafe.js',
        './src/js/tabs/firmware_flasher.js',
        './src/js/tabs/gps.js',
        './src/js/tabs/help.js',
        './src/js/tabs/landing.js',
        './src/js/tabs/led_strip.js',
        './src/js/tabs/logging.js',
        './src/js/tabs/map.js',
        './src/js/tabs/motors.js',
        './src/js/tabs/onboard_logging.js',
        './src/js/tabs/osd.js',
        './src/js/tabs/pid_tuning.js',
        './src/js/tabs/ports.js',
        './src/js/tabs/power.js',
        './src/js/tabs/receiver.js',
        './src/js/tabs/receiver_msp.js',
        './src/js/tabs/sensors.js',
        './src/js/tabs/servos.js',
        './src/js/tabs/setup.js',
        './src/js/tabs/setup_osd.js',
        './src/js/tabs/transponder.js',
        './src/js/main.js',
        './src/js/eventPage.js',

        // Src
        './src/*.html',
        './src/tabs/*.html',
        './src/images/**/*',
    ];

    return gulp.src(distSources, { base: 'src' })
        .pipe(gulp.src('manifest.json', { passthrougth: true }))
        .pipe(gulp.src('package.json', { passthrougth: true }))
        .pipe(gulp.src('changelog.html', { passthrougth: true }))
        .pipe(gulp.dest(DIST_DIR))
        .pipe(install({
            npm: '--production --ignore-scripts'
        }));
};

function dist_locale() {
    return gulp.src('./locales/**/*', { base: 'locales'})
        .pipe(gulp.dest(DIST_DIR + '_locales'));
}

function dist_libraries() {
    return gulp.src('./libraries/**/*', { base: '.'})
        .pipe(gulp.dest(DIST_DIR + 'js'));
}

function dist_resources() {
    return gulp.src('./resources/**/*', { base: '.'})
        .pipe(gulp.dest(DIST_DIR));
}

// Create runable app directories in ./apps
function apps(done) {
    var platforms = getPlatforms();
    removeItem(platforms, 'chromeos');

    buildNWApps(platforms, 'normal', APPS_DIR, done);
};

function listPostBuildTasks(folder, done) {

    var platforms = getPlatforms();

    var postBuildTasks = [];

    if (platforms.indexOf('linux32') != -1) {
        postBuildTasks.push(function post_build_linux32(done){ return post_build('linux32', folder, done) });
    }

    if (platforms.indexOf('linux64') != -1) {
        postBuildTasks.push(function post_build_linux64(done){ return post_build('linux64', folder, done) });
    }

    // We need to return at least one task, if not gulp will throw an error
    if (postBuildTasks.length == 0) {
        postBuildTasks.push(function post_build_none(done){ done() });
    }
    return postBuildTasks;
}

function post_build(arch, folder, done) {

    if ((arch =='linux32') || (arch == 'linux64')) {
        // Copy Ubuntu launcher scripts to destination dir
        var launcherDir = path.join(folder, pkg.name, arch);
        console.log('Copy Ubuntu launcher scripts to ' + launcherDir);
        return gulp.src('assets/linux/**')
                   .pipe(gulp.dest(launcherDir));
    }

    return done();
}

// Create debug app directories in ./debug
function debug(done) {
    var platforms = getPlatforms();
    removeItem(platforms, 'chromeos');

    buildNWApps(platforms, 'sdk', DEBUG_DIR, done);
}

function buildNWApps(platforms, flavor, dir, done) {

    if (platforms.length > 0) {
        var builder = new NwBuilder(Object.assign({
            buildDir: dir,
            platforms: platforms,
            flavor: flavor
        }, nwBuilderOptions));
        builder.on('log', console.log);
        builder.build(function (err) {
            if (err) {
                console.log('Error building NW apps: ' + err);
                clean_debug();
                process.exit(1);
            }
            done();
        });
    } else {
        console.log('No platform suitable for NW Build')
        done();
    }
}


function start_debug(done) {

    var platforms = getPlatforms();

    var exec = require('child_process').exec;    
    if (platforms.length === 1) {
        var run = getRunDebugAppCommand(platforms[0]);
        console.log('Starting debug app (' + run + ')...');
        exec(run);
    } else {
        console.log('More than one platform specified, not starting debug app');
    }
    done();
}

// Create installer package for windows platforms
function release_win(arch, done) {

    // The makensis does not generate the folder correctly, manually
    createDirIfNotExists(RELEASE_DIR);

    // Parameters passed to the installer script
    const options = {
            verbose: 2,
            define: {
                'VERSION': pkg.version,
                'PLATFORM': arch,
                'DEST_FOLDER': RELEASE_DIR
            }
        }

    var output = makensis.compileSync('./assets/windows/installer.nsi', options);

    if (output.status !== 0) {
        console.error('Installer for platform ' + arch + ' finished with error ' + output.status + ': ' + output.stderr);
    }

    done();
}

// Create distribution package (zip) for windows and linux platforms
function release_zip(arch) {
    var src = path.join(APPS_DIR, pkg.name, arch, '**');
    var output = getReleaseFilename(arch, 'zip');
    var base = path.join(APPS_DIR, pkg.name, arch);

    return compressFiles(src, base, output, 'Betaflight Configurator');
}

// Create distribution package for chromeos platform
function release_chromeos() {
    var src = path.join(DIST_DIR, '**');
    var output = getReleaseFilename('chromeos', 'zip');
    var base = DIST_DIR;

    return compressFiles(src, base, output, '.');
}

// Compress files from srcPath, using basePath, to outputFile in the RELEASE_DIR
function compressFiles(srcPath, basePath, outputFile, zipFolder) {
    return gulp.src(srcPath, { base: basePath })
               .pipe(rename(function(actualPath){ actualPath.dirname = path.join(zipFolder, actualPath.dirname) }))
               .pipe(zip(outputFile))
               .pipe(gulp.dest(RELEASE_DIR));
}

function release_deb(arch) {

    var debArch;

    switch (arch) {
    case 'linux32':
        debArch = 'i386';
        break;
    case 'linux64':
        debArch = 'amd64';
        break;
    default:
        console.error("Deb package error, arch: " + arch);
        process.exit(1);
        break;
    }

    return gulp.src([path.join(APPS_DIR, pkg.name, arch, '*')])
        .pipe(deb({
             package: pkg.name,
             version: pkg.version,
             section: 'base',
             priority: 'optional',
             architecture: debArch,
             maintainer: pkg.author,
             description: pkg.description,
             postinst: ['xdg-desktop-menu install /opt/betaflight/betaflight-configurator/betaflight-configurator.desktop /opt/betaflight/betaflight-configurator/betaflight-configurator-english.desktop'],
             prerm: ['xdg-desktop-menu uninstall betaflight-configurator.desktop betaflight-configurator-english.desktop'],
             depends: 'libgconf-2-4',
             changelog: [],
             _target: 'opt/betaflight/betaflight-configurator',
             _out: RELEASE_DIR,
             _copyright: 'assets/linux/copyright',
             _clean: true
    }));
}

// Create distribution package for macOS platform
function release_osx64() {
    var appdmg = require('gulp-appdmg');

    // The appdmg does not generate the folder correctly, manually
    createDirIfNotExists(RELEASE_DIR);

    // The src pipe is not used
    return gulp.src(['.'])
        .pipe(appdmg({
            target: path.join(RELEASE_DIR, getReleaseFilename('macOS', 'dmg')),
            basepath: path.join(APPS_DIR, pkg.name, 'osx64'),
            specification: {
                title: 'Betaflight Configurator',
                contents: [
                    { 'x': 448, 'y': 342, 'type': 'link', 'path': '/Applications' },
                    { 'x': 192, 'y': 344, 'type': 'file', 'path': pkg.name + '.app', 'name': 'Betaflight Configurator.app' }
                ],
                background: path.join(__dirname, 'assets/osx/dmg-background.png'),
                format: 'UDZO',
                window: {
                    size: {
                        width: 638,
                        height: 479
                    }
                }
            },
        })
    );
}

// Create the dir directory, with write permissions
function createDirIfNotExists(dir) {
    fs.mkdir(dir, '0775', function(err) {
        if (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
    });
}

// Create a list of the gulp tasks to execute for release
function listReleaseTasks(done) {

    var platforms = getPlatforms();

    var releaseTasks = [];

    if (platforms.indexOf('chromeos') !== -1) {
        releaseTasks.push(release_chromeos);
    }

    if (platforms.indexOf('linux64') !== -1) {
        releaseTasks.push(function release_linux64_zip(){ return release_zip('linux64') });
        releaseTasks.push(function release_linux64_deb(){ return release_deb('linux64') });
    }

    if (platforms.indexOf('linux32') !== -1) {
        releaseTasks.push(function release_linux32_zip(){ return release_zip('linux32') });
        releaseTasks.push(function release_linux32_deb(){ return release_deb('linux32') });
    }

    if (platforms.indexOf('osx64') !== -1) {
        releaseTasks.push(release_osx64);
    }

    if (platforms.indexOf('win32') !== -1) {
        releaseTasks.push(function release_win32(done){ return release_win('win32', done) });
    }
    
    if (platforms.indexOf('win64') !== -1) {
        releaseTasks.push(function release_win64(done){ return release_win('win64', done) });
    }

    return releaseTasks;
}
