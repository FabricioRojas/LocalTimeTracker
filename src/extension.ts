import * as vscode from 'vscode';
import * as path from 'path';
let fs = require("fs");
let currentLang = '';

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.executeCommand("extension.initTimer");
	// vscode.window.registerWebviewPanelSerializer('vsttMainPage', new VSTimeTrckerSerializer());

	vscode.window.onDidChangeActiveTextEditor((textEditor: any) => {
		currentLang = textEditor._documentData._languageId;
	},
		null,
		context.subscriptions
	);

	vscode.window.onDidChangeWindowState((windowState: any) => {
		vscode.commands.executeCommand("extension.updateStatusTimer");
	},
		null,
		context.subscriptions
	);

	if (vscode.window.activeTextEditor) {
		currentLang = vscode.window.activeTextEditor.document.languageId;
	}

	let filePath = '/timeTraked.json';
	let filePathL = '/timeTrakedL.json';
	let projectName = vscode.workspace.name;
	let currentPanel: vscode.WebviewPanel | undefined = undefined;
	let timerInterval: NodeJS.Timeout;
	let seconds = 0;
	let currentDate = new Date();
	let dd = currentDate.getDate() > 9 ? currentDate.getDate(): '0'+currentDate.getDate();
	let mm = (currentDate.getMonth()+1) > 9 ? (currentDate.getMonth()+1) : '0'+(currentDate.getMonth()+1);
	let yyyy = currentDate.getFullYear();
	let fullCurrentDate = dd+"-"+mm+"-"+yyyy;

	const timer = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
	initItem(timer, "VSTT $(clock)", "View stats", "extension.getTime");

	const pause = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	initItem(pause, "ll", "Pause/Start timer", "extension.updateStatusTimer");

	// context.extensionPath+'/src/cat.gif'+filePath
	initFileL(filePathL, projectName,context,fullCurrentDate);
	initFile(filePath, projectName,context,fullCurrentDate);

	let initTimer = vscode.commands.registerCommand('extension.initTimer', () => {
		vscode.window.showInformationMessage('Timer started!');

		timerInterval = setInterval(() => {
			timer.text = "VSTT $(clock) " + secondsToReadableTime(seconds);
			let jsonTime = JSON.parse(fs.readFileSync(vscode.workspace.rootPath + filePath, 'utf8'));
			let languageTime = jsonTime.languageTime;
			if (currentLang !== '') {
				if (languageTime[currentLang]) {
					languageTime[currentLang] = languageTime[currentLang] + 1;
				} else {
					languageTime[currentLang] = 1;
				}
			}

			let timeProjects = JSON.parse(fs.readFileSync(context.extensionPath+filePathL, 'utf8'));
			let dates = timeProjects.dates;
			
			let newDay = true;
			for(var i in dates){
				if(dates[i].projectName === projectName){
					if(dates[i].date === fullCurrentDate){
						newDay = false;
						dates[i].languageTime = languageTime;
						break;
					}
				}
			}
			if(newDay){
				dates.push({
					date:fullCurrentDate,
					projectName: projectName,
					languageTime: languageTime
				});
			}

			saveFileL(filePathL,projectName,context,dates);
			saveFile(filePath,projectName,context,seconds,jsonTime,languageTime);

			seconds++;
			if (seconds % 1800 === 0) {
				vscode.window.showInformationMessage('You should take a break!', 'Break!').then(() => {
					vscode.commands.executeCommand("extension.updateStatusTimer");
				});
			}
		}, 1000);
	});

	let getTime = vscode.commands.registerCommand('extension.getTime', () => {
		// let jsonTime = JSON.parse(fs.readFileSync(vscode.workspace.rootPath + filePath, 'utf8'));
		// vscode.window.showInformationMessage('Time logged: ' + secondsToReadableTime(jsonTime.totalTime));

		const columnToShowIn = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (currentPanel) {
			currentPanel.reveal(columnToShowIn);
		} else {
			const panel = vscode.window.createWebviewPanel(
				'vsttMainPage',
				'VSTimeTracker',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src'))]
				}
			);
			currentPanel = panel;

			const onDiskPath = vscode.Uri.file(
				path.join(context.extensionPath, 'src', 'Chart.bundle.min.js')
			  );
			const canvasJS = onDiskPath.with({ scheme: 'vscode-resource' });
			

			const updateWebview = () => {
				let jsonTime = JSON.parse(fs.readFileSync(vscode.workspace.rootPath + filePath, 'utf8'));
				let timeProjects = JSON.parse(fs.readFileSync(context.extensionPath+filePathL, 'utf8'));
				panel.webview.html = getWebviewContent(jsonTime, timeProjects, canvasJS);
			};
			updateWebview();
		    //const interval = setInterval(updateWebview, 1000);

			currentPanel.onDidDispose(() => {
				currentPanel = undefined;
				// clearInterval(interval);
				console.log("BYE!");
			},
				null,
				context.subscriptions
			);

			// 	panel.webview.onDidReceiveMessage(
			// 		message => {

			// 			fs.writeFile(vscode.workspace.rootPath + filePath, JSON.stringify(message), () => {
			// 				// console.log("The file was saved!");
			// 			});
			// 			switch (message.command) {
			// 				case 'alert':
			// 					vscode.window.showErrorMessage(message.text);
			// 					return;
			// 			}
			// 		},
			// 		undefined,
			// 		context.subscriptions
			// 	);
			// }
		}
		// 5jenre3yi33gksblukk5f6ed6336mademujrddfaznjeb7ae57ta
	});

	let pauseTimer = vscode.commands.registerCommand('extension.updateStatusTimer', () => {
		if (pause.text === "ll") {
			vscode.window.showInformationMessage('Timer paused!');
			pause.text = "$(triangle-right)";
			clearInterval(timerInterval);
			let jsonTime = JSON.parse(fs.readFileSync(vscode.workspace.rootPath + filePath, 'utf8'));
			seconds = jsonTime.currentSession + 1;
		} else {
			pause.text = "ll";
			vscode.commands.executeCommand("extension.initTimer");
			timer.text = "VSTT $(clock) " + secondsToReadableTime(seconds);
			let jsonTime = JSON.parse(fs.readFileSync(vscode.workspace.rootPath + filePath, 'utf8'));
			fs.writeFileSync(vscode.workspace.rootPath + filePath, JSON.stringify({
				currentSession: seconds,
				prevSession: jsonTime.prevSession,
				totalTime: jsonTime.totalTime + 1,
				projectName: projectName,
				languageTime: jsonTime.languageTime
			}));
			seconds++;
		}
	});

	let clearStats = vscode.commands.registerCommand('extension.clearStatsRestartTimer', () => {
		clearInterval(timerInterval);
		vscode.commands.executeCommand("extension.initTimer");
		seconds = 0;
		fs.writeFileSync(vscode.workspace.rootPath + filePath, JSON.stringify({
			currentSession: 0,
			prevSession: 0,
			totalTime: 0,
			projectName: projectName,
			languageTime: {}
		}));
	});

	context.subscriptions.push(initTimer);
	context.subscriptions.push(getTime);
	context.subscriptions.push(pauseTimer);
	context.subscriptions.push(clearStats);
}

function initFile(filePath:any,projectName:any,context:any,fullCurrentDate:String){
	try {
		if (fs.existsSync(vscode.workspace.rootPath + filePath)) {
			let jsonTime = JSON.parse(fs.readFileSync(vscode.workspace.rootPath + filePath, 'utf8'));
			if (jsonTime.currentSession > 0) {
				fs.writeFileSync(vscode.workspace.rootPath + filePath, JSON.stringify({
					currentSession: 0,
					prevSession: jsonTime.currentSession,
					totalTime: jsonTime.totalTime + jsonTime.prevSession,
					projectName: projectName,
					languageTime: jsonTime.languageTime
				}));
			}
		} else {
			fs.writeFileSync(vscode.workspace.rootPath + filePath, JSON.stringify({
				currentSession: 0,
				prevSession: 0,
				totalTime: 0,
				projectName: projectName,
				languageTime: {}
			}));
		}
	} catch (err) {
		vscode.window.showInformationMessage("Couldn't start timer");
	}
}

function initFileL(filePathL:any,projectName:any,context:any,fullCurrentDate:String){
	try {
		if (!fs.existsSync(context.extensionPath+filePathL)) {
			fs.writeFileSync(context.extensionPath+filePathL, JSON.stringify({
				dates: [{
					date:fullCurrentDate,
					projectName: projectName,
					languageTime: {}
				}],
			}));
		}
	} catch (err) {
		vscode.window.showInformationMessage("Couldn't start timer");
	}
}

function saveFile(filePath:any,projectName:any,context:any,seconds:any,jsonTime:any,languageTime:any){
	try{
		fs.writeFileSync(vscode.workspace.rootPath + filePath, JSON.stringify({
			currentSession: seconds,
			prevSession: jsonTime.prevSession,
			totalTime: jsonTime.totalTime + 1,
			projectName: projectName,
			languageTime: languageTime
		}));
	}catch(err){}	
}

function saveFileL(filePathL:any,projectName:any,context:any,dates:any){
	try{	
		fs.writeFileSync(context.extensionPath+filePathL, JSON.stringify({
			dates: dates
		}));
	}catch(err){}
}

function secondsToReadableTime(secs: any) {
	secs = Math.round(secs);
	var hours = Math.floor(secs / (60 * 60));

	var divisor_for_minutes = secs % (60 * 60);
	var minutes = Math.floor(divisor_for_minutes / 60);

	var divisor_for_seconds = divisor_for_minutes % 60;
	var seconds = Math.ceil(divisor_for_seconds);

	let sessionTime = seconds + " s";
	if (minutes > 0) {
		sessionTime = minutes + " m " + sessionTime;
	}
	if (hours > 0) {
		sessionTime = hours + " h " + sessionTime;
	}
	return sessionTime;
}

function initItem(item: any, text: String, tooltip: String, command: String) {
	item.text = text;
	item.tooltip = tooltip;
	item.command = command;
	item.show();
}

function getWebviewContent(jsonTime: any, timeProjects: any, canvasJS: any) {	
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <!--<meta http-equiv="Content-Security-Policy" content="default-src 'none';">-->
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>`+ jsonTime.projectName + `</title>
  </head>
  <body>
	  	<h1 style="display:none;">Current session time: `+ secondsToReadableTime(jsonTime.currentSession) + `</h1>
	  	<h1>Previous session time: `+ secondsToReadableTime(jsonTime.prevSession) + `</h1>
	  	<ul id="lang-list" style="display:none;">
		  	`+ languagesList(jsonTime.languageTime) + `
	  	</ul>
	  	<!--<div id="chartContainer" style="height: 370px; width: 100%;"></div>-->
	  	<div class="canvas-div">
	  		<h1>Current project total time: `+ secondsToReadableTime(jsonTime.totalTime) + `</h1>
			<canvas id="languagesChart"></canvas>
		</div>
		<div class="canvas-div">
			<h1>Total time: `+ getTotalTime(timeProjects.dates) + `</h1>
		  	<canvas id="projectsChart"></canvas>
	  	</div>	  
		<script src="${canvasJS}"></script>
		<script>
		var dataPoints = `+ pieData(jsonTime.languageTime)+ `;
		var dataPointsL = `+ pieDataL(timeProjects.dates)+ `;
		window.onload = function() {
			var ctx = document.getElementById('languagesChart').getContext('2d');
			var chart = new Chart(ctx, {
				type: 'pie',
				data: dataPoints,
				options: {
					tooltips: {
						callbacks: {
							label: function(tooltipItem, data) {
								var label = data.labels[tooltipItem.index] || '';
								if (label) {
									label += ': ';
								}
								label += data.labelsValue[tooltipItem.index];
								return label;
							}
						}
					},
				}
			});
			
			chart.canvas.parentNode.style.width = '49%';
			chart.canvas.parentNode.style.float = 'left';

			var ctxL = document.getElementById('projectsChart').getContext('2d');
			var chartL = new Chart(ctxL, {
				type: 'pie',
				data: dataPointsL,
				options: {
					tooltips: {
						callbacks: {
							label: function(tooltipItem, data) {
								var label = data.labels[tooltipItem.index] || '';
								if (label) {
									label += ': ';
								}
								label += data.labelsValue[tooltipItem.index];
								return label;
							}
						}
					}
				}
			});
			
			chartL.canvas.parentNode.style.width = '49%';
			chartL.canvas.parentNode.style.float = 'right';
		}
		window.addEventListener('message', event => {

            const message = event.data;
            switch (message.command) {
                case 'refactor':
                    count = Math.ceil(count * 0.5);
                    counter.textContent = count;
                    break;
            }
        });
    </script>
  </body>
  </html>`;
}

function random_rgba() {
    var o = Math.round, r = Math.random, s = 255;
    return 'rgba(' + o(r()*s) + ',' + o(r()*s) + ',' + o(r()*s) + ',' + r().toFixed(1) + ')';
}

function pieData(time:any){
	let data = [];
	let labels = [];
	let labelsValue = [];
	let backgroundColor = [];
	let borderColor = [];
	for(var i in time){
		data.push(time[i]);
		labels.push(i);
		labelsValue.push(secondsToReadableTime(time[i]));
		backgroundColor.push(random_rgba());
		borderColor.push('transparent');
	}
	let dataPoints = {
		datasets: [{
			data: data,
			backgroundColor: backgroundColor,
			borderColor: borderColor
		}], 
		labels: labels,
		labelsValue: labelsValue
	};

	return JSON.stringify(dataPoints);
}
function pieDataL(dates:any){
	let data = [];
	let labels = [];
	let labelsValue = [];
	let backgroundColor = [];
	let borderColor = [];

	let globalLangTime = <any>{};
	for(var j in dates){
		let currentLog = dates[j];
		for(var i in currentLog.languageTime){
			let time = currentLog.languageTime[i];
			if (globalLangTime[i] === 'undefined') { globalLangTime[i] += time; }
			else { globalLangTime[i] = time; }
		}
	}

	for(var x in globalLangTime){
		data.push(globalLangTime[x]);
		labels.push(x);
		labelsValue.push(secondsToReadableTime(globalLangTime[x]));
		backgroundColor.push(random_rgba());
		borderColor.push('transparent');
	}

	let dataPointsL = {
		datasets: [{
			data: data,
			backgroundColor: backgroundColor,
			borderColor: borderColor
		}], 
		labels: Object.keys(globalLangTime),
		labelsValue: labelsValue
	};

	return JSON.stringify(dataPointsL);
}

function languagesList(languageTime:any){
	let listContent = '';
	for(var i in languageTime){
		listContent+='<li>'+i+": "+secondsToReadableTime(languageTime[i])+'</li>';
	}
	return listContent;
}

function getTotalTime(timeProjects:any){
	let totalTime = 0;
	for(var j in timeProjects){
		let currentLog = timeProjects[j];
		for(var i in currentLog.languageTime){
			let time = currentLog.languageTime[i];
			totalTime+=time;
		}
	}
	return secondsToReadableTime(totalTime);
}

export function deactivate() {
	console.log("deactivate");
}

class VSTimeTrckerSerializer implements vscode.WebviewPanelSerializer {
	async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
		// const onDiskPath = vscode.Uri.file(
		// 	path.join(vscode.extensionPath, 'src', 'canvasjs.min.js')
		//   );
		// const canvasJS = onDiskPath.with({ scheme: 'vscode-resource' });
		// let jsonTime = JSON.parse(fs.readFileSync(vscode.workspace.rootPath + "/timeTraked.json", 'utf8'));
		// webviewPanel.webview.html = getWebviewContent(jsonTime, "",canvasJS);
	}
}
