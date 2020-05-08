import * as vscode from 'vscode';
import * as path from 'path';
let fs = require("fs");
let currentLang = '';
let colors: any;
let gWindowState: boolean = true;

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.executeCommand("extension.initTimer");
	// vscode.window.registerWebviewPanelSerializer('LTTMainPage', new VSTimeTrckerSerializer());

	vscode.window.onDidChangeActiveTextEditor((textEditor: any) => {
		currentLang = textEditor._documentData._languageId;
		projectName = vscode.workspace.name;
	},
		null,
		context.subscriptions
	);

	vscode.window.onDidChangeWindowState((windowState: vscode.WindowState) => {
		gWindowState = windowState.focused;
		projectName = vscode.workspace.name;
		vscode.commands.executeCommand("extension.updateStatusTimerAuto");
	},
		null,
		context.subscriptions
	);

	if (vscode.window.activeTextEditor) {
		currentLang = vscode.window.activeTextEditor.document.languageId;
	}

	let filePath = path.join(context.extensionPath, 'timeTraked.json');
	let filePathL = path.join(context.extensionPath, 'timeTrakedL.json');
	let colorPath = path.join(context.extensionPath, 'colors.json');
	let projectName = vscode.workspace.name;
	let currentPanel: vscode.WebviewPanel | undefined = undefined;
	let timerInterval: NodeJS.Timeout;
	let seconds = 0;
	let currentDate = new Date();
	let dd = currentDate.getDate() > 9 ? currentDate.getDate() : '0' + currentDate.getDate();
	let mm = (currentDate.getMonth() + 1) > 9 ? (currentDate.getMonth() + 1) : '0' + (currentDate.getMonth() + 1);
	let yyyy = currentDate.getFullYear();
	let fullCurrentDate = dd + "-" + mm + "-" + yyyy;
	colors = JSON.parse(fs.readFileSync(colorPath, 'utf8'));

	const timer = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
	initItem(timer, "LTT $(clock)", "View stats", "extension.getTime");

	const pause = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	initItem(pause, "ll", "Pause/Start timer", "extension.updateStatusTimer");

	initFileL(filePathL, projectName, context, fullCurrentDate);
	initFile(filePath, projectName, context, fullCurrentDate);

	let initTimer = vscode.commands.registerCommand('extension.initTimer', () => {
		vscode.window.showInformationMessage('Timer started!');
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(() => {
			timer.text = "LTT $(clock) " + secondsToReadableTime(seconds);
			let jsonTime = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			let currentProject;
			for (var i in jsonTime.projects) {
				if (jsonTime.projects[i].projectName == projectName) {
					currentProject = jsonTime.projects[i];
					break;
				}
			}
			if (!currentProject) {
				currentProject = {
					currentSession: 0,
					prevSession: 0,
					totalTime: 0,
					projectName: projectName,
					languageTime: {}
				}
				jsonTime.projects.push(currentProject);
			}
			let languageTime = currentProject.languageTime;
			if (currentLang !== '') {
				if (languageTime[currentLang]) {
					languageTime[currentLang] = languageTime[currentLang] + 1;
				} else {
					languageTime[currentLang] = 1;
				}
			}

			saveFile(filePath, projectName, context, seconds, jsonTime, languageTime);

			let timeProjects = JSON.parse(fs.readFileSync(filePathL, 'utf8'));
			let dates = timeProjects.dates;

			let newDay = true;
			for (var i in dates) {
				if (dates[i].projectName === projectName) {
					if (dates[i].date === fullCurrentDate) {
						newDay = false;
						dates[i].languageTime = languageTime;
						break;
					}
				}
			}
			if (newDay) {
				dates.push({
					date: fullCurrentDate,
					projectName: projectName,
					languageTime: languageTime
				});
			}

			saveFileL(filePathL, projectName, context, dates);

			seconds++;
			if (seconds % 1800 === 0) {
				vscode.window.showInformationMessage('You should take a break!', 'Break!').then(() => {
					vscode.commands.executeCommand("extension.updateStatusTimer");
				});
			}
		}, 1000);
	});

	let getTime = vscode.commands.registerCommand('extension.getTime', () => {
		// let jsonTime = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		colors = JSON.parse(fs.readFileSync(colorPath, 'utf8'));
		if (currentPanel) currentPanel.dispose();
		const columnToShowIn = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		vscode.window.onDidChangeWindowState((windowState: vscode.WindowState) => {
			// if(currentPanel) currentPanel.dispose();	//HERE
		},
			null,
			context.subscriptions
		);

		if (currentPanel) {
			currentPanel.reveal(columnToShowIn);
		} else {
			const panel = vscode.window.createWebviewPanel(
				'LTTMainPage',
				'Local Time Tracker Stats',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath))]
				}
			);
			currentPanel = panel;

			const onDiskPath = vscode.Uri.file(path.join(context.extensionPath, 'Chart.bundle.min.js'));
			const canvasJS = onDiskPath.with({ scheme: 'vscode-resource' });

			const updateWebview = () => {
				let jsonTime = JSON.parse(fs.readFileSync(filePath, 'utf8'));
				let timeProjects = JSON.parse(fs.readFileSync(filePathL, 'utf8'));
				panel.webview.html = getWebviewContent(jsonTime, timeProjects, canvasJS, projectName);
			};
			updateWebview();
			// const interval = setInterval(updateWebview, 1000);

			currentPanel.onDidDispose(() => {
				currentPanel = undefined;
				// clearInterval(interval);
			},
				null,
				context.subscriptions
			);

			// 	panel.webview.onDidReceiveMessage(
			// 		message => {

			// 			fs.writeFile(filePath, JSON.stringify(message), () => {
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
	});

	let pauseTimer = vscode.commands.registerCommand('extension.updateStatusTimer', () => {
		if (pause.text === "ll") {
			vscode.window.showInformationMessage('Timer paused!');
			pause.text = "$(triangle-right)";
			clearInterval(timerInterval);
			let jsonTime = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			seconds = jsonTime.currentSession + 1;
		} else {
			pause.text = "ll";
			vscode.commands.executeCommand("extension.initTimer");
			timer.text = "LTT $(clock) " + secondsToReadableTime(seconds);
			let jsonTime = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			for (var i in jsonTime.projects) {
				if (jsonTime.projects[i].projectName == projectName) {
					jsonTime.projects[i] = {
						currentSession: seconds,
						prevSession: jsonTime.projects[i].prevSession,
						totalTime: jsonTime.projects[i].totalTime + 1,
						projectName: projectName,
						languageTime: jsonTime.projects[i].languageTime
					}
					break;
				}
			}
			fs.writeFileSync(filePath, JSON.stringify(jsonTime));
			seconds++;
		}
	});
	let pauseTimerAuto = vscode.commands.registerCommand('extension.updateStatusTimerAuto', () => {
		if (!gWindowState) {
			vscode.window.showInformationMessage('Timer paused!');
			pause.text = "$(triangle-right)";
			clearInterval(timerInterval);
			let jsonTime = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			for (var i in jsonTime.projects) {
				if (jsonTime.projects[i].projectName == projectName) {
					seconds = jsonTime.projects[i].currentSession + 1;
					break;
				}
			}
		} else {
			pause.text = "ll";
			vscode.commands.executeCommand("extension.initTimer");
			timer.text = "LTT $(clock) " + secondsToReadableTime(seconds);
			let jsonTime = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			for (var i in jsonTime.projects) {
				if (jsonTime.projects[i].projectName == projectName) {
					if (jsonTime.projects[i].currentSession > 0) {
						jsonTime.projects[i] = {
							currentSession: seconds,
							prevSession: jsonTime.projects[i].prevSession,
							totalTime: jsonTime.projects[i].totalTime + 1,
							projectName: projectName,
							languageTime: jsonTime.projects[i].languageTime
						}
					}
					break;
				}
			}
			fs.writeFileSync(filePath, JSON.stringify(jsonTime));
			seconds++;
		}
	});

	let clearStats = vscode.commands.registerCommand('extension.clearStatsRestartTimer', () => {
		clearInterval(timerInterval);
		vscode.commands.executeCommand("extension.initTimer");
		seconds = 0;
		fs.writeFileSync(filePath, JSON.stringify({
			projects: [{
				currentSession: 0,
				prevSession: 0,
				totalTime: 0,
				projectName: projectName,
				languageTime: {}
			}]
		}));
		fs.writeFileSync(filePathL, JSON.stringify({
			dates: [{
				date: '',
				projectName: '',
				languageTime: {}
			}],
		}));
	});

	let resetColors = vscode.commands.registerCommand('extension.resetLanguagesColors', () => {
		fs.writeFileSync(colorPath, JSON.stringify({}));
	});

	context.subscriptions.push(initTimer);
	context.subscriptions.push(getTime);
	context.subscriptions.push(pauseTimer);
	context.subscriptions.push(pauseTimerAuto);
	context.subscriptions.push(clearStats);
	context.subscriptions.push(resetColors);
}

function initFile(filePath: any, projectName: any, context: any, fullCurrentDate: String) {
	try {
		if (fs.existsSync(filePath)) {
			let jsonTime = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			for (var i in jsonTime.projects) {
				if (jsonTime.projects[i].projectName == projectName) {
					if (jsonTime.projects[i].currentSession > 0) {
						jsonTime.projects[i] = {
							currentSession: 0,
							prevSession: jsonTime.projects[i].currentSession,
							totalTime: jsonTime.projects[i].totalTime + jsonTime.projects[i].prevSession,
							projectName: projectName,
							languageTime: jsonTime.projects[i].languageTime
						}
						fs.writeFileSync(filePath, JSON.stringify(jsonTime));
					}
					break;
				}
			}
		} else {
			fs.writeFileSync(filePath, JSON.stringify({
				projects: [{
					currentSession: 0,
					prevSession: 0,
					totalTime: 0,
					projectName: projectName,
					languageTime: {}
				}]
			}));
		}
	} catch (err) {
		vscode.window.showInformationMessage("Couldn't start timer error code: 1");
	}
}

function initFileL(filePathL: any, projectName: any, context: any, fullCurrentDate: String) {
	try {
		if (!fs.existsSync(filePathL)) {
			fs.writeFileSync(filePathL, JSON.stringify({
				dates: [{
					date: fullCurrentDate,
					projectName: projectName,
					languageTime: {}
				}],
			}));
		}
	} catch (err) {
		vscode.window.showInformationMessage("Couldn't start timer error code: 2");
	}
}

function saveFile(filePath: any, projectName: any, context: any, seconds: any, jsonTime: any, languageTime: any) {
	try {
		for (var i in jsonTime.projects) {
			if (jsonTime.projects[i].projectName == projectName) {
				jsonTime.projects[i] = {
					currentSession: seconds,
					prevSession: jsonTime.projects[i].prevSession,
					totalTime: jsonTime.projects[i].totalTime + 1,
					projectName: projectName,
					languageTime: languageTime
				}
				break;
			}
		}
		fs.writeFileSync(filePath, JSON.stringify(jsonTime));
	} catch (err) {
		console.log("saveFile err", err)
	}
}

function saveFileL(filePathL: any, projectName: any, context: any, dates: any) {
	try {
		fs.writeFileSync(filePathL, JSON.stringify({
			dates: dates
		}));
	} catch (err) { }
}

function secondsToReadableTime(secs: any) {
	secs = Math.round(secs);
	var hours = Math.floor(secs / (60 * 60));

	var divisor_for_minutes = secs % (60 * 60);
	var minutes = Math.floor(divisor_for_minutes / 60);

	var divisor_for_seconds = divisor_for_minutes % 60;
	var seconds = Math.ceil(divisor_for_seconds);

	let sessionTime = seconds + "s";
	if (minutes > 0) sessionTime = minutes + "m " + sessionTime;
	if (hours > 0) sessionTime = hours + "h " + sessionTime;

	return sessionTime;
}

function initItem(item: any, text: String, tooltip: String, command: String) {
	item.text = text;
	item.tooltip = tooltip;
	item.command = command;
	item.show();
}

function getWebviewContent(jsonTime: any, timeProjects: any, canvasJS: any, projectName: any) {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <!--<meta http-equiv="Content-Security-Policy" content="default-src 'none';">-->
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>${projectName}</title>
	  <style>
			hr { 
				display: block;
				margin-top: 2.5em;
				margin-bottom: 0.5em;
				margin-left: auto;
				margin-right: auto;
				border-style: inset;
				border-width: 1px;
			}
			.header-div{
				display: flex;
			}
			.header-div h2{
				width: 50%;
			}
			#lang-list{
				display:none;
			}
			span{
				font-weight: 100;
			}
			#chartContainer{
				height: 300px; 
				max-height: 300px; 
				width: 100%;
			}
			.ul-languages{
				list-style: none;
			}
			.ul-languages div{
				width:13px; 
				height:13px; 
				display: inline-block; 
				margin: 0 5px 0 0;
			}
			.ul-languages h3{
				display: contents;
			}
		</style>
  </head>
  <body>
  		<h1>Local Time Tracker Stats:</h1>
		<div class="header-div">
	  		<h2>Current session time: <span>${secondsToReadableTime(getCurrentProject(jsonTime, projectName).currentSession)}</span></h2>
		  	<h2>Previous session time: <span>${secondsToReadableTime(getCurrentProject(jsonTime, projectName).prevSession)}</span></h2>
		</div>

		<hr>
	  	<ul id="lang-list">
		  	${languagesList(getCurrentProject(jsonTime, projectName).languageTime)}
	  	</ul>
	  	<div id="chartContainer">
			<div class="canvas-div">
				<h2>${projectName ? projectName : "Current project"} total time: <span>${secondsToReadableTime(getCurrentProject(jsonTime, projectName).totalTime)}</span></h2>
				<canvas id="languagesChart"></canvas>
			</div>
			<div class="canvas-div">
				<h2>Total programming time: <span>${getTotalTime(timeProjects.dates)}</span></h2>
				<canvas id="projectsChart"></canvas>
			</div>
		</div>

		<!--<hr>-->
		<h1>Time by project:</h1>
		${getTimeByProject(timeProjects.dates, jsonTime)}

		<script src="${canvasJS}"></script>
		<script>
			var dataPoints = ${pieData(getCurrentProject(jsonTime, projectName).languageTime, getCurrentProject(jsonTime, projectName).totalTime)};
			var dataPointsL = ${pieDataL(timeProjects.dates)};
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
										label = label.replace(label[0], label[0].toUpperCase())
										//label += ': ';
									}
									//label += data.labelsValue[tooltipItem.index];
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
										label = label.replace(label[0], label[0].toUpperCase())
										//label += ': ';
									}
									//label += data.labelsValue[tooltipItem.index];
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

function getCurrentProject(jsonObject: any, projectName: any) {
	for (var i in jsonObject.projects) {
		if (jsonObject.projects[i].projectName == projectName) {
			return jsonObject.projects[i];
			break;
		}
	}
	return null;
}

function random_rgba(lang: string) {
	var color = colors[lang];
	if (!colors[lang]) {
		var o = Math.round, r = Math.random, s = 255;
		color = 'rgba(' + o(r() * s) + ',' + o(r() * s) + ',' + o(r() * s) + ',' + r().toFixed(1) + ')';
		colors[lang] = color;
		addColor();
	}
	if (lang == 'others') color = 'rgba(143,9,9,56)';
	return color;
}

function addColor() {
	try {
		var extension: any = vscode.extensions.getExtension('FabricioRojas.vstimetracker');
		fs.writeFileSync(path.normalize(extension.extensionPath) + '/colors.json', JSON.stringify(colors));
		colors = JSON.parse(fs.readFileSync(path.normalize(extension.extensionPath) + '/colors.json', 'utf8'));
	} catch (err) { }
}

function pieData(time: any, totalProjectTime: any) {
	let data = [];
	let labels = [];
	let labelsValue = [];
	let backgroundColor = [];
	let borderColor = [];
	let totalTime = 0;
	for (var i in time) {
		data.push(time[i]);
		totalTime += time[i];
		labels.push(i.replace(i[0], i[0].toUpperCase()) + ": " + secondsToReadableTime(time[i]));
		labelsValue.push(secondsToReadableTime(time[i]));
		backgroundColor.push(random_rgba(i));
		borderColor.push('transparent');
	}
	if (totalTime != totalProjectTime) {
		data.push(totalProjectTime - totalTime);
		labels.push("Others: " + secondsToReadableTime(totalProjectTime - totalTime));
		labelsValue.push(secondsToReadableTime(totalProjectTime - totalTime));
		backgroundColor.push(random_rgba('others'));
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
function pieDataL(dates: any) {
	let data = [];
	let labels = [];
	let labelsValue = [];
	let backgroundColor = [];
	let borderColor = [];

	let globalLangTime = <any>{};
	for (var j in dates) {
		let currentLog = dates[j];
		for (var i in currentLog.languageTime) {
			let time = currentLog.languageTime[i];
			if (typeof globalLangTime[i] === 'undefined') globalLangTime[i] = time;
			else globalLangTime[i] += time;
		}
	}
	for (var x in globalLangTime) {
		data.push(globalLangTime[x]);
		labels.push(x.replace(x[0], x[0].toUpperCase()) + ": " + secondsToReadableTime(globalLangTime[x]));
		labelsValue.push(secondsToReadableTime(globalLangTime[x]));
		backgroundColor.push(random_rgba(x));
		borderColor.push('transparent');
	}
	let dataPointsL = {
		datasets: [{
			data: data,
			backgroundColor: backgroundColor,
			borderColor: borderColor
		}],
		labels: labels,
		labelsValue: labelsValue
	};

	return JSON.stringify(dataPointsL);
}

function languagesList(languageTime: any) {
	let listContent = '';
	for (var i in languageTime) {
		listContent += '<li>' + i + ": " + secondsToReadableTime(languageTime[i]) + '</li>';
	}
	return listContent;
}

function getTotalTime(timeProjects: any) {
	let totalTime = 0;
	for (var j in timeProjects) {
		let currentLog = timeProjects[j];
		for (var i in currentLog.languageTime) {
			let time = currentLog.languageTime[i];
			totalTime += time;
		}
	}
	return secondsToReadableTime(totalTime);
}
function getTimeByProject(timeProjects: any, jsonTime: any) {
	let totalTime = 0;
	let html = '';
	let lis = '';

	let timeByProject: any = {};
	for (var j in timeProjects) {
		let currentLog = timeProjects[j];
		for (var i in currentLog.languageTime) {
			let time = currentLog.languageTime[i];
			try {
				if (timeByProject[currentLog.projectName] && timeByProject[currentLog.projectName][i]) {
					timeByProject[currentLog.projectName][i] += time;
				} else {
					if (!timeByProject[currentLog.projectName]) timeByProject[currentLog.projectName] = {};
					timeByProject[currentLog.projectName][i] = time;
				}
			} catch (err) {
				console.log("err", err);
			}
		}
	}

	for (var j in timeByProject) {
		let currentLog = timeByProject[j];
		console.log(currentLog, j);
		let totalProjectTime = getCurrentProject(jsonTime, j).totalTime;
		if (Object.keys(currentLog).length < 1) continue;
		let proName = j && j != 'undefined' ? j : "Unknown project";
		html += `<div><h2>${proName}: `;
		for (var i in currentLog) {
			let time = currentLog[i];
			totalTime += time;
			lis += `<li><div style="background-color:${random_rgba(i)};"></div><h3>${i.replace(i[0], i[0].toUpperCase())}: <span>${secondsToReadableTime(time)}</span></h3></li>`;
		}
		if (totalTime != totalProjectTime) {
			lis += `<li><div style="background-color:${random_rgba('others')};"></div><h3>Others: <span>${secondsToReadableTime(totalProjectTime - totalTime)}</span></h3></li>`;
			totalTime += totalProjectTime - totalTime;
		}
		html += `<span>${secondsToReadableTime(totalTime)}</span></h2><ul class="ul-languages">`;
		html += lis;
		html += '</ul></div>';
		lis = '';
		totalTime = 0;
	}
	return html;
}

export function deactivate() {
	console.log("deactivate");
}

class VSTimeTrckerSerializer implements vscode.WebviewPanelSerializer {
	async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
		// const onDiskPath = vscode.Uri.file(
		// 	path.join(vscode.extensionPath, 'canvasjs.min.js')
		//   );
		// const canvasJS = onDiskPath.with({ scheme: 'vscode-resource' });
		// let jsonTime = JSON.parse(fs.readFileSync(context.extensionPath + "/timeTraked.json", 'utf8'));
		// webviewPanel.webview.html = getWebviewContent(jsonTime, "",canvasJS, projectName);
	}
}
