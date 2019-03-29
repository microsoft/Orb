# Orb Release Notes Archive

12/12/2017
> * Adding support for string type requiredbaseprops in namespace definition. [avvarma]

12/7/2017
> * Added Heatmap resource type. Define heatmaps using Kusto and PowerShell-sourced data and visualize them in Orb. Read the [Adding Objects and Resources](models.md) section for more information [crowenby].
> * Added internal framework to build new resources using React and Orb data providers. [crowenby]
> * Added option to specify parse depth on Object Explorer views for the PSMD resource. [crowenby]

11/21/2017
> * Appends time range to dgrep resource if not specified in object definition. [xusong]

11/20/2017
> * Added option to disable pathless search for objects with long-running constructors or constructors that require user input. [crowenby]
> * Display PowerShell objects in an interactive tree using new PSMD options.
    Read the [Adding Objects and Resources](models.md) section for more information. [crowenby]
> * Create your own React-based Markdown Extensions.

11/02/2017
> * Log Kusto errors on failures. [xusong]
> * Fixed Kusto gzip,deflate error.

11/01/2017
> * Fix for Ctrl + C behavior in terminal. The behavior is identical to PS terminals now. [gajagt]
> * Ctrl + Backspace deletes words in terminals.

10/31/2017
> * HTML-formatted link fix. [crowenby]

10/29/2017
> * URL escape issue fix. [xusong]

10/24/2017
> * ClickOnce support added. Now you can launch Execution Graphs and other ClickOnce app links directly from Orb. [gajagt]

10/20/2017
> * You can now build Orb objects and fetch properties using PowerShell scripts. Read the [PowerShell Objects](powershellObjects.md) section for more information. [crowenby]
> * Share links with modifiable parameters. Press CTRL + L to copy link to current view with parameters.
> * You can now specify a customized display name for objects using *requiredProps* and *requiredBaseProps*. Read the [Adding Objects and Resources](models.md) section for more information.

10/20/2017
> * Upgraded to Electron 1.7.5. This brings a lot of perf improvements and bug fixes. [gajagt]

10/19/2017
> * Fixed bugs when closing IcM triage session. [xusong]
> * Don't prompt to start another session for the same incident under triage session.

10/11/2017
> * Clicking on resources now defaults to opening a new tab. If you prefer the same tab being reused, change the *alwaysOpenInNewTab* option in _Preferences_. [crowenby]

9/27/2017
> * You can now specify a customized display name for objects using *requiredProps* and *requiredBaseProps*. Read the [Adding Objects and Resources](models.md) section for more information. [crowenby]

9/26/2017
> * PowerShell is now a data provider. Read the [Adding Objects and Resources](models.md) section for more information. [crowenby]

9/21/2017
> * Share links with modifiable parameters. Press CTRL + L to copy link to current view with parameters. [crowenby]

9/19/2017
> * Added an option to clear Orb cache. Browser->Clear Cache. [xusong]

9/14/2017
> * Enabled description tooltips in Explorer when user hovers over objects. [crowenby]

9/5/2017
> * Open an ICM incident to trigger ICM triage mode. Learn more about it [here.](icmIntegration.md) [xusong]
> * Provide suggested objects/resources, similar incidents for given incident.

8/31/2017
> * Added ability to use {startTime} and {endTime} in Kusto resources. [crowenby]
> * Configure font-family and font-size under Edit > Preferences. Restart Orb using Shift+F5 to apply changes. [crowenby]

8/24/2017
> * Cleanup old files while installing/updating Orb. [xusong]
> * TabManager height bug fix.
> * Acis Auth fix for SAW.

8/24/2017
> * Fixed bug that caused global objects to be searched when no path specified. [crowenby]
> * Transferred _main.js_ to _main.ts_ and optimized dependency loading. [crowenby]

8/4/2017
> * Hit enter to search. [xusong]
> * Close all the objects on explorer page.

7/26/2017
> * Right Click "Search for Object" option to lookup objects from selected text. [abketkar]

7/25/2017
> * Added a properties page to view all required/additional props. [gajagt]
> * Right-click an object in explorer and select properties or search for *.prop in the address bar.

7/24/2017
> * Upgraded Terminal Xterm.js to 2.8.1 [gajagt]
> * Enables multi-page selection.
> * Double-click to select Guid.
> * Preserve windows line endings on copy/paste.
> * Lots of other performance fixes.
> * In-page search for terminal support removed temporarily.

7/21/2017
> * Added national clouds support. [xusong]
> * Automatically converts saved Dgrep/Kusto queries from Public endpoints to NC endpoints. Learn more [here](models.md)

7/14/2017
> * Trim the query on the search page. [rrusso]

6/7/2017
> * Search for resources in the address bar. [xusong]
> * Autocomplete resource paths for objects pinned to the explorer. [xusong]

6/6/2017
> * Added address bar. [xusong]
> * Press Ctrl + T to open a new tab.
> * Press Alt + D to select address bar content.

6/6/2017
> * Add Kusto additionalProp support. Enhance objects with an arbitrary number of properties. Learn more [here](models.md). [gajagt]
> * Update to Squirrel 1.7.0. Prevents deletion of in-use Orb versions. [gajagt]

5/23/2017
> * Customize terminal font and colors in config. [xusong]

5/16/2017
> * Added update notification. [xusong]

5/2/2017
> * Integrated Spectron/Chai/Mocha/Enzyme/Sinon in Orb tests. [xusong]

4/26/2017
> * Added Acis resource type. Click [here](models.md) for details. [gajagt]

4/25/2017
> * Added Orb link support. [xusong]
> * Press Ctrl + L to share Orb state.
> * Added relative mode in DateTime widget.
> * Always open a new tab if the current tab is a terminal.
> * Context menu resources always open in new tabs.

4/21/2017
> * Allow terminals to change tab title. [abketkar]
> * Added "Pin to Explorer". Allows pinning associated objects to explorer on right click. [shpati]
> * Added tab support for 'Close to the Left' and 'Close Others.' Close current tab with Ctrl+W. [travisje]
> * Added "Open all". Right-click on a directory to all resources in a directory in new tabs. [gajagt]
> * Added support for background tabs. [sathyasi]
> * Added spinner favicon when tab is still loading. [caortizm]

4/12/2017
> * Added terminal management capabilities. See more details [here](terminal.md). [gajagt]
> * Added .terminal resource type.
> * Added file format support for Orb. Share files that restore Orb state or trigger actions. See more details [here](fileFormat.md).

4/8/2017
> * Added instrumentation using Azure App Insights. [xusong]

4/6/2017
> * Use Base64 encoding for Kusto Urls to avoid symbol characters from being dropped. [gajagt]
> * Allow opening new windows and tabs from opened resources.

3/24/2017
> * Add multiple tabs support. [xusong]
> * Ctrl+Click on a resource opens a new tab.

3/7/2017
> * Kusto resources now open in Kusto Web Explorer by default.
> * You can right-click on a Kusto resource and select "Open in Kusto explorer" to run queries in the client App.

2/28/2017
> * Full PowerShell terminal added to NavBar.
> * Ctrl+F allows searching through terminal output.
> * Run any psmd file in the new Orb terminal.
> * A new "Run in Terminal" link added to all psmd pages.

2/21/2017
> * Time widget improvements - paste a timestamp with any format into the time widget.
> * Explorer Time preserved on Orb restart.
> * Kusto token auto-refresh in the background.

1/25/2017
> * Add Object Editing and Publishing experience.
> * New Editor Page created - edit objects and push changes remotely for sharing.
> * Changes made using Right-click to edit on an object can also be pushed remotely in the Editor page.

1/18/2017
> * Add support for multiple objects in explorer.

1/10/2017
> * Add search in page support (triggered by Ctrl + F).
> * Keyboard shortcuts for Back, Forward and Refresh.
> * Mouse button handler for Back and Forward.

1/5/2017
> * Add editor support.
> * Add right click root node to edit object definition in editor.

1/5/2017
> * Added PowerShell host handler for Prompt Inputs and Confirmations.
> * Added additionalProps field to define constant strings that can be re-used in the object definition file.

12/20/2016
> * Add time range selector to explorer.
> * Add the ability to invoke C# code and PowerShell in Orb.
> * Add psmd resource type to run PowerShell scripts and format results as markdown.

12/6/2016
> * Add right-click context menu support for the root node and object nodes in explorer.
> * Allow objects to use any resource in the context menu.
> * Add PowerShell profiles in namespaceConfig.json.
> * Add psx resource type to invoke any script in an external PowerShell window.
> * Add "Connect with FcShell" to context menu for FC objects.

12/6/2016
> * Add right-click context menu support on resource nodes in explorer.
> * Allow copying links and opening them in the default browser from the context menu.
> * Add browser right-click context menu in the content pane.

11/29/2016
> * Markdown Support Added.
> * v0 Documentation Added.
> * Shift + click in Explorer opens resources in your default Web Browser.