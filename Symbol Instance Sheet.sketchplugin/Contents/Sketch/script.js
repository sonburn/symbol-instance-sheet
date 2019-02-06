@import 'delegate.js';

var pluginName = __command.pluginBundle().name(),
	pluginDomain = __command.pluginBundle().identifier(),
	pluginVersion = __command.pluginBundle().version(),
	debugMode = false;

var sketch = require('sketch'),
	libraries = sortJSON(sketch.getLibraries(),'name'),
	document = sketch.getSelectedDocument(),
	data = document.sketchObject.documentData(),
	page = document.selectedPage,
	selection = document.selectedLayers;

var alertWindowWidth = 300,
	alertColumnWidth = 120,
	alertFieldHeight = 22,
	alertFieldWidth = 60,
	alertLabelHeight = 16,
	alertSelectHeight = 28,
	alertSettingPad = 10,
	alertSwitchHeight = 16,
	alertTextOffset = 2;

var inventory = function(context) {
	var libraryArray = ['Current Document'];

	libraries.forEach(function(library){
		libraryArray.push(library.name);
	});

	var libraryPages = [],
		scopeArray = ['All Symbols'];

	document.pages.forEach(function(page){
		if (page.sketchObject.symbols().length) {
			libraryPages.push(page.id);
			scopeArray.push(page.name);
		}
	});

	var alert = NSAlert.alloc().init();
		alert.setIcon(getPluginAlertIcon());
		alert.setMessageText(pluginName);
		alert.setInformativeText('Generate a sheet of symbol instances from your current document or a library.');

	var alertContent = NSView.alloc().init();
		alertContent.setFlipped(true);

	var symbolLibraryLabel = createAlertLabelBold('Source:',12,NSMakeRect(0,0,alertWindowWidth,alertLabelHeight));

	alertContent.addSubview(symbolLibraryLabel);

	var symbolLibrarySelect = createAlertSelect(libraryArray,0,NSMakeRect(0,CGRectGetMaxY(symbolLibraryLabel.frame()) + alertTextOffset,alertWindowWidth,alertSelectHeight));

	var symbolLibrarySelectDelegate = new MochaJSDelegate({
		"comboBoxSelectionDidChange:" : (function() {
			var librarySelectValue = symbolLibrarySelect.indexOfSelectedItem(),
				librarySource = document;

			if (librarySelectValue != 0) {
				var selectedLibrary = libraries[librarySelectValue - 1], // Shifted to account for "Current Document"
					selectedLibraryID = selectedLibrary.id,
					selectedLibraryName = selectedLibrary.name,
					selectedLibraryPath = NSURL.fileURLWithPath(selectedLibrary.sketchObject.locationOnDisk().path());

				sketch.Document.open(selectedLibraryPath,(err,library) => {
					if (err) {
						sketch.UI.alert(pluginName,'Unable to open the selected library file.');
					}

					if (library) {
						librarySource = library;

						library.close();
					}
				});

				symbolUseCheckbox.setEnabled(1);
			} else {
				symbolUseCheckbox.setEnabled(0);
			}

			libraryPages = [];
			scopeArray = ['All Symbols'];

			librarySource.pages.forEach(function(page){
				if (page.sketchObject.symbols().length) {
					libraryPages.push(page.id);
					scopeArray.push(page.name);
				}
			});

			symbolScopeSelect.removeAllItems();
			symbolScopeSelect.addItemsWithObjectValues(scopeArray);
			symbolScopeSelect.selectItemAtIndex(0);
		})
	});

	symbolLibrarySelect.setDelegate(symbolLibrarySelectDelegate.getClassInstance());

	alertContent.addSubview(symbolLibrarySelect);

	var symbolScopeLabel = createAlertLabelBold('Scope:',12,NSMakeRect(0,CGRectGetMaxY(symbolLibrarySelect.frame()) + alertSettingPad,alertWindowWidth,alertLabelHeight));

	alertContent.addSubview(symbolScopeLabel);

	var symbolScopeSelect = createAlertSelect(scopeArray,0,NSMakeRect(0,CGRectGetMaxY(symbolScopeLabel.frame()) + alertTextOffset,alertWindowWidth,alertSelectHeight));

	alertContent.addSubview(symbolScopeSelect);

	var symbolScopeSelectDelegate = new MochaJSDelegate({
		"comboBoxSelectionDidChange:" : (function() {
			var symbolScopeSelectValue = symbolScopeSelect.indexOfSelectedItem();

			if (symbolScopeSelectValue == 0) {
				symbolUseCheckbox.setEnabled(1);
			} else {
				symbolUseCheckbox.setEnabled(0);
			}
		})
	});

	symbolScopeSelect.setDelegate(symbolScopeSelectDelegate.getClassInstance());

	var symbolUseCheckbox = createAlertCheckbox({name:'Only symbols used in this document',value:1},0,NSMakeRect(0,CGRectGetMaxY(symbolScopeSelect.frame()) + alertSettingPad,alertWindowWidth,alertSwitchHeight));

	symbolUseCheckbox.setEnabled(0);

	alertContent.addSubview(symbolUseCheckbox);

	// var symbolOutputCheckbox = createAlertCheckbox({name:'Output as new page',value:1},0,NSMakeRect(0,CGRectGetMaxY(symbolUseCheckbox.frame()) + alertSettingPad,alertWindowWidth,alertSwitchHeight));
	//
	// alertContent.addSubview(symbolOutputCheckbox);

	alertContent.setFrame(NSMakeRect(0,0,alertWindowWidth,CGRectGetMaxY(symbolUseCheckbox.frame())));

	alert.setAccessoryView(alertContent);

	var buttonSubmit = alert.addButtonWithTitle('Generate');
	var buttonCancel = alert.addButtonWithTitle('Cancel');

	var responseCode = alert.runModal();

	if (responseCode == 1000) {
		var librarySelectValue = symbolLibrarySelect.indexOfSelectedItem(),
			outputPage = page,
			outputSymbols,
			selectedLibrary;

		if (librarySelectValue != 0) {
			selectedLibrary = libraries[librarySelectValue - 1]; // Shifted to account for "Current Document"

			if (symbolUseCheckbox.state() == 1) {
				outputSymbols = NSMutableArray.array();

				data.foreignSymbols().forEach(function(symbol){
					if (symbol.libraryID() == selectedLibrary.id) {
						outputSymbols.addObject(symbol.originalMaster());
					}
				});
			} else {
				var selectedLibraryPath = NSURL.fileURLWithPath(selectedLibrary.sketchObject.locationOnDisk().path());

				sketch.Document.open(selectedLibraryPath,(err,library) => {
					if (err) {
						sketch.UI.alert(pluginName,'Unable to open the selected library file.');
					}

					if (library) {
						var librarySource = library;

						library.close();

						if (symbolScopeSelect.indexOfSelectedItem() == 0) {
							outputSymbols = librarySource.sketchObject.documentData().localSymbols();
						} else {
							librarySource.pages.forEach(function(page){
								if (page.id == libraryPages[symbolScopeSelect.indexOfSelectedItem() - 1]) {
									outputSymbols = page.sketchObject.symbols();
								}
							});
						}
					}
				});
			}
		} else {
			var librarySource = document;

			if (symbolScopeSelect.indexOfSelectedItem() == 0) {
				outputSymbols = librarySource.sketchObject.documentData().localSymbols();
			} else {
				librarySource.pages.forEach(function(page){
					if (page.id == libraryPages[symbolScopeSelect.indexOfSelectedItem() - 1]) {
						outputSymbols = page.sketchObject.symbols();
					}
				});
			}
		}

		if (!outputSymbols.length) {
			sketch.UI.alert(pluginName,'There are no symbols in the selected source & scope.');

			return;
		}

		// if (symbolOutputCheckbox.state() == 1) {
		// 	var pageName = (librarySelectValue == 0) ? "Current Document" : selectedLibrary.name;
		//
		// 	var newPage = document.sketchObject.addBlankPage();
		//
		// 	newPage.setName(pageName);
		// 	newPage.setRulerBase(CGPointMake(0,0));
		//
		// 	outputPage = newPage;
		// }

		outputSymbols.forEach(function(symbol){
			var symbolMaster = (librarySelectValue == 0) ? symbol : importForeignSymbol(symbol,selectedLibrary.sketchObject).symbolMaster(),
				symbolInstance = symbolMaster.newSymbolInstance();

			symbolInstance.frame().setX(symbolMaster.frame().x());
			symbolInstance.frame().setY(symbolMaster.frame().y());

			outputPage.sketchObject.insertLayer_atIndex(symbolInstance,nil);
		});

		document.sketchObject.contentDrawView().zoomToFitRect(page.sketchObject.contentBounds());

		if (!debugMode) googleAnalytics(context,"sheet","run");
	} else return false;
}

var report = function(context) {
	openUrl("https://github.com/sonburn/symbol-instance-sheet/issues/new");

	if (!debugMode) googleAnalytics(context,"report","report");
}

var plugins = function(context) {
	openUrl("https://sonburn.github.io/");

	if (!debugMode) googleAnalytics(context,"plugins","plugins");
}

var donate = function(context) {
	openUrl("https://www.paypal.me/sonburn");

	if (!debugMode) googleAnalytics(context,"donate","donate");
}

function createAlertCheckbox(item,flag,frame) {
	var checkbox = NSButton.alloc().initWithFrame(frame),
		flag = (flag == false) ? NSOffState : NSOnState;

	checkbox.setButtonType(NSSwitchButton);
	checkbox.setBezelStyle(0);
	checkbox.setTitle(item.name);
	checkbox.setTag(item.value);
	checkbox.setState(flag);

	return checkbox;
}

function createAlertLabelBold(text,size,frame) {
	var label = NSTextField.alloc().initWithFrame(frame);

	label.setStringValue(text);
	label.setFont(NSFont.boldSystemFontOfSize(size));
	label.setBezeled(false);
	label.setDrawsBackground(false);
	label.setEditable(false);
	label.setSelectable(false);

	return label;
}

function createAlertSelect(items,selectedItemIndex,frame) {
	var comboBox = NSComboBox.alloc().initWithFrame(frame),
		selectedItemIndex = (selectedItemIndex > -1) ? selectedItemIndex : 0;

	comboBox.addItemsWithObjectValues(items);
	comboBox.selectItemAtIndex(selectedItemIndex);
	comboBox.setNumberOfVisibleItems(16);
	comboBox.setCompletes(1);

	return comboBox;
}

function getPluginAlertIcon() {
	if (__command.pluginBundle() && __command.pluginBundle().alertIcon()) {
		return __command.pluginBundle().alertIcon();
	}

	return NSImage.imageNamed('plugins');
}

function googleAnalytics(context,category,action,label,value) {
	var trackingID = "UA-118978647-1",
		uuidKey = "google.analytics.uuid",
		uuid = NSUserDefaults.standardUserDefaults().objectForKey(uuidKey);

	if (!uuid) {
		uuid = NSUUID.UUID().UUIDString();
		NSUserDefaults.standardUserDefaults().setObject_forKey(uuid,uuidKey);
	}

	var url = "https://www.google-analytics.com/collect?v=1";
	// Tracking ID
	url += "&tid=" + trackingID;
	// Source
	url += "&ds=sketch" + MSApplicationMetadata.metadata().appVersion;
	// Client ID
	url += "&cid=" + uuid;
	// pageview, screenview, event, transaction, item, social, exception, timing
	url += "&t=event";
	// App Name
	url += "&an=" + encodeURI(context.plugin.name());
	// App ID
	url += "&aid=" + context.plugin.identifier();
	// App Version
	url += "&av=" + context.plugin.version();
	// Event category
	url += "&ec=" + encodeURI(category);
	// Event action
	url += "&ea=" + encodeURI(action);
	// Event label
	if (label) {
		url += "&el=" + encodeURI(label);
	}
	// Event value
	if (value) {
		url += "&ev=" + encodeURI(value);
	}

	var session = NSURLSession.sharedSession(),
		task = session.dataTaskWithURL(NSURL.URLWithString(NSString.stringWithString(url)));

	task.resume();
}

function importForeignSymbol(symbol,library) {
	var objectReference = MSShareableObjectReference.referenceForShareableObject_inLibrary(symbol,library);

	return AppController.sharedInstance().librariesController().importShareableObjectReference_intoDocument(objectReference,data);
}

function openUrl(url) {
	NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString(url));
}

function sortJSON(data,key) {
	return data.sort(function(a,b) {
		var x = a[key];
		var y = b[key];

		return ((x < y) ? -1 : ((x > y) ? 1 : 0));
	});
}
