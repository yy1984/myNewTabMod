
'use strict';

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Downloads.jsm');
Cu.import('resource://gre/modules/PlacesUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');

var myNewTabMod = {
	Yooo: null,   //神秘的代码
	dataFolder: null,   //扩展数据文件夹
	dataFile: null,   //导航网址数据文件
	prefs: Services.prefs.getBranch('extensions.myNewTabMod.'),
	PREFS: {
		backgroundImage: '',   //背景图片地址
		bingMaxHistory: 10,   //最大历史天数，可设置[2, 16]
		imageDir: 'bingImg',   //图片存储的文件夹名字
		isNewTab: true,   //是否新标签页打开导航链接或搜索结果
		path: 'myNewTabMod',   //myNewTabMod文件夹的相对于配置文件的路径
		title: '我的主页',   //网页标题
		updateImageTime: 12,   //更新bing背景图片的间隔（单位：小时）
		useBigImage: true,   //bing图片的尺寸，0为默认的1366x768，1为1920x1080
		useBingImage: true,   //使用bing的背景图片
		weatherSrc: 'http://i.tianqi.com/index.php?c=code&id=8&num=3'   //天气代码的URL
	},
	
	//输出错误信息
	log: function(e) {
		console.log('myNewTabMod line#' + e.lineNumber + ' ' + e.name + ' : ' + e.message);
	},
	//切换|下载背景图
	changeImg: function() {
		if (this.PREFS.useBingImage) {
			this.getBingImage(Math.floor(Math.random() * this.PREFS.bingMaxHistory));
			return;
		}
		var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
		fp.init(window, '设置背景图片', fp.modeOpen);
		fp.appendFilters(fp.filterImages);
		if (fp.show() == fp.returnCancel || !fp.file) {
			return;
		}
		this.PREFS.backgroundImage = Services.io.newFileURI(fp.file).spec;
		var str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
		str.data = this.PREFS.backgroundImage;
		this.prefs.setComplexValue('backgroundImage', Ci.nsISupportsString, str);
		document.body.style.backgroundImage = 'url("' + this.PREFS.backgroundImage + '")';
	},
	
	//定位文件目录
	openDir: function() {
		this.dataFolder.reveal();
	},

	//编辑配置
	edit: function() {
		var editor;
		try {
			editor = Services.prefs.getComplexValue('view_source.editor.path', Ci.nsILocalFile);
		} catch(e) {
			this.log(e);
		}

		if (!editor || !editor.exists()) {
			alert('请先设置编辑器的路径!!!');
			var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
			fp.init(window, '设置全局脚本编辑器', fp.modeOpen);
			fp.appendFilter('执行文件', '*.exe');
			if (fp.show() == fp.returnCancel || !fp.file) {
				return;
			} else {
				editor = fp.file;
				var str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
				str.data = editor.path;
				Services.prefs.setComplexValue('view_source.editor.path', Ci.nsISupportsString, str);
			}
		}

		var process = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
		var args = [this.dataFile.path];
		process.init(editor);
		process.runw(false, args, args.length);
	},
	
	//获取参数
	getPrefs: function() {
		for (var key in this.PREFS) {
			switch (this.prefs.getPrefType(key)) {
				case this.prefs.PREF_STRING:
					this.PREFS[key] = this.prefs.getComplexValue(key, Ci.nsISupportsString).toString();
					break;
				case this.prefs.PREF_INT:
					this.PREFS[key] = this.prefs.getIntPref(key);
					break;
				case this.prefs.PREF_BOOL:
					this.PREFS[key] = this.prefs.getBoolPref(key);
					break;
			}
		}
	},
	//初始化数据文件
	initFile: function() {
		this.dataFolder = Services.dirsvc.get('ProfD', Ci.nsIFile);
		this.dataFolder.appendRelativePath(this.PREFS.path);
		this.dataFile = this.dataFolder.clone();
		this.dataFile.appendRelativePath('data.txt');
		
		//插入css文件
		var cssFile = this.dataFolder.clone();
		cssFile.appendRelativePath('style.css');
		var style = document.createElement('link');
		style.rel = 'stylesheet';
		style.type = 'text/css';
		style.href = Services.io.newFileURI(cssFile).spec;
		document.getElementsByTagName('head')[0].appendChild(style);
	},
	//初始化网页
	initDocument: function() {
		document.title = this.PREFS.title;
		document.getElementById('weather').src = this.PREFS.weatherSrc;
		document.getElementById('weather').onload = function() {   //为天气iframe设置css
			var cssWeather = Services.dirsvc.get('ProfD', Ci.nsIFile);
			cssWeather.appendRelativePath('extensions\\mynewtabmod@sakuyaa\\chrome\\skin\\weather.css');
			//https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIDOMWindowUtils
			var domWindowUtils = document.getElementById('weather').contentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWindowUtils.loadSheet(Services.io.newFileURI(cssWeather), domWindowUtils.USER_SHEET);
		};
		document.getElementById('solar').innerHTML = Solar.getSolar(new Date());
		document.getElementById('lunar').innerHTML = Lunar.getLunar(new Date());
	},
	//初始化导航网址
	initSite: function() {
		var table = document.getElementById('navtable');
		if (table.children.lenth > 0) {
			return;
		}
		//读取配置文件
		if (!this.dataFile.exists()) {
			alert('文件不存在：' + this.dataFile.path); 
			return;
		}
		var content;
		try {
			var fis = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
			fis.init(this.dataFile, -1, -1, fis.CLOSE_ON_EOF);
			var sis = Cc['@mozilla.org/scriptableinputstream;1'].createInstance(Ci.nsIScriptableInputStream);
			sis.init(fis);
			var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Ci.nsIScriptableUnicodeConverter);
			converter.charset = 'UTF-8';
			content = converter.ConvertToUnicode(sis.read(sis.available()));
		} catch(e) {
			alert('不能读取文件：' + this.dataFile.path);
			return;
		} finally {
			sis.close();
		}
		
		var siteData = this.parseDataText(content);
		for(var type in siteData) {
			if (type == 'Yooo') {   //神秘的代码
				this.Yooo = this.buildTr(type, siteData[type]);
				this.Yooo.id = 'Yooo';
				continue;
			}
			table.appendChild(this.buildTr(type, siteData[type]));
		}
		
		setTimeout(function() {   //延时以避免主界面offsetHeight高度获取的值偏小
			//当主div不占满网页时使其居中偏上
			var clientHeight = document.documentElement.clientHeight;
			var offsetHeight = document.getElementById('main').offsetHeight;
			if (offsetHeight < clientHeight) {
				document.getElementById('main').style.marginTop = (clientHeight - offsetHeight) / 4 + 'px';
			}
		}, 100);
		
		//神秘的代码
		document.onkeydown = function(e) {
			//Firefox only, not IE
			//var e=e || event;
			//var currKey = e.keyCode || e.which || e.charCode;
			//var keyName = String.fromCharCode(currKey);
			//alert('按键码: ' + currKey + ' 字符: ' + keyName);
			if (myNewTabMod.Yooo && e.which == 81 && e.ctrlKey && document.getElementById('Yooo') == null) {
				document.getElementById('navtable').appendChild(myNewTabMod.Yooo);
			}
		};
		document.onkeyup = function(e) {
			var tr = document.getElementById('Yooo');
			if (tr != null) {
				document.getElementById('navtable').removeChild(tr);
			}
		};
	},

	init: function() {
		this.getPrefs();
		this.initFile();
		this.initDocument();
		this.initSite();
		
		if (this.PREFS.useBingImage) {   //获取bing中国主页的背景图片
			var data = this.loadSetting();
			if (data.backgroundImage && (Date.now() - data.lastCheckTime) < this.PREFS.updateImageTime * 3600 * 1000) {
				document.body.style.backgroundImage = 'url("' + data.backgroundImage + '")';
			} else {
				this.getBingImage(0);
			}
		} else {
			var image;
			try {
				image = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler).getFileFromURLSpec(this.PREFS.backgroundImage);
			} catch(e) {}
			if (!image || !image.exists()) {   //尚未设置背景图片路径
				alert('请先设置背景图片的路径!!!');
				this.changeImg();
			} else {
				document.body.style.backgroundImage = 'url("' + this.PREFS.backgroundImage + '")';
			}
		}
	},
	
	//加载设置
	loadSetting: function() {
		var jsonData;
		try {
			jsonData = this.prefs.getCharPref('jsonData');
			jsonData = JSON.parse(jsonData);
		} catch(e) {
			this.log(e);
			jsonData = {}
		}
		return jsonData;
	},
	
	//设置背景图片并保存设置
	setAndSave: function(ImgPath) {
		document.body.style.backgroundImage = 'url("' + ImgPath + '")';
		var Jsondata = {
			lastCheckTime: Date.now(),
			backgroundImage: ImgPath
		};
		try {
			this.prefs.setCharPref('jsonData', JSON.stringify(Jsondata));
		} catch(e) {
			this.log(e);
		}
	},
	
	getBingImage: function(idx) {
		var url = 'http://cn.bing.com/HPImageArchive.aspx?format=js&idx=' + idx + '&n=1&nc=';
		//var url = 'http://www.bing.com/HPImageArchive.aspx?format=js&idx=' + idx + '&n=1&nc=' + Date.now() + '&pid=hp&scope=web';
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onload = function() {
			var data = JSON.parse(xhr.responseText);

			var name = data.images[0].copyright;
			var enddate = parseInt(data.images[0].enddate);
			var imageUrl = data.images[0].url;

			//处理图片地址
			if (myNewTabMod.PREFS.useBigImage) {
				imageUrl = imageUrl.replace('1366x768', '1920x1080');
			}
			if (!imageUrl.startsWith('http')) {
				imageUrl = 'http://www.bing.com' + imageUrl;
			}

			//本地图片
			var file = myNewTabMod.dataFolder.clone();
			file.appendRelativePath(myNewTabMod.PREFS.imageDir);
			file.appendRelativePath(enddate + '-' + name.replace(/(\s|\(.*?\))/g, '') + '.jpg');

			//转为本地路径
			var filePath = Services.io.newFileURI(file).spec;
			
			if (file.exists()) {
				myNewTabMod.setAndSave(filePath);
				return;
			}

			//下载图片
			var t = new Image();
			t.src = imageUrl;
			t.onload = function() {
				try {
					file.create(file.NORMAL_FILE_TYPE, 511);
					Downloads.fetch(Services.io.newURI(imageUrl, null, null), file);
					/*Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Ci.nsIWebBrowserPersist)
						.saveURI(Services.io.newURI(imageUrl, null, null), null, null, null, null, null, file, null);*/
				} catch (ex if ex instanceof Downloads.Error && ex.becauseTargetFailed) {
					console.log('Unable to write to the target file, ignoring the error.');
				}
				setTimeout(function() {
					myNewTabMod.setAndSave(filePath);
				}, 100);
			}
		};
		xhr.send(null);
	},
	
	parseDataText: function (text) {
		var data = [],
			lines, line, arr, type;

		//处理下，逗号修正为英文逗号
		text = text.replace(/，/g, ',');

		lines = text.split('\n');
		for (var i = 0, l = lines.length; i < l; i++) {
			line = lines[i].trim();
			if (!line) {
				continue;
			}
			arr = line.split(',');
			if (arr.length == 1) {
				type = arr[0];
				data[type] = [];
			} else {
				data[type].push({
					name: arr[0].trim(),
					url: arr[1] ? arr[1].trim() : null,
					imgSrc: arr[2] ? arr[2].trim() : null
				});
			}
		}
		return data;
	},
	
	buildTr: function(type, sites) {
		var tr = document.createElement('tr'),
			th = document.createElement('th'),
			span = document.createElement('span'),
			site, td, a, img, textNode, path;
		
		//添加分类
		span.textContent = type;
		th.appendChild(span);
		tr.appendChild(th);

		//图标地址
		var icoURL = 'file:///' + encodeURI(this.dataFolder.path.replace(/\\/g, '/'));
		
		//添加站点
		for (var i = 0, l = sites.length; i < l; i++) {
			site = sites[i];

			td = document.createElement('td');
			a = document.createElement('a');
			img = document.createElement('img');
			textNode = document.createTextNode(site.name);

			a.setAttribute('title', site.name);
			path = this.handleUrl(site.url);
			if (path) {
				a.setAttribute('href', 'javascript:;');
				a.setAttribute('localpath', path);
				a.addEventListener('click', function(e) {
					var fullpath = e.target.getAttribute('localpath');
					myNewTabMod.exec(fullpath);
				}, false);

				site.exec = path;
			} else {
				a.setAttribute('href', site.url);
			}

			if (this.PREFS.isNewTab) {
				a.setAttribute('target', '_blank');
			}
			
			//设置图片的属性
			img.width = 16;
			img.height = 16;
			if (site.imgSrc) {
				if (site.imgSrc[0] == '/') {
					img.src = icoURL + site.imgSrc;   //转为本地路径
				} else {
					img.src = site.imgSrc;
				}
			} else {
				this.setIcon(img, site);
			}

			a.appendChild(img);
			a.appendChild(textNode);
			td.appendChild(a);
			tr.appendChild(td);
		}
		return tr;
	},
	
	handleUrl: function (urlOrPath) {
		if (urlOrPath.indexOf('\\') == 0) {   //相对firefox路径文件
			urlOrPath = urlOrPath.replace(/\//g, '\\').toLocaleLowerCase();
			var profileDir = Services.dirsvc.get('ProfD', Ci.nsILocalFile).path;
			return profileDir + urlOrPath;
		} else if (/^[a-z]:\\[^ ]+$/i.test(urlOrPath)) {   //windows路径
			return urlOrPath;
		}
		return false;
	},
	
	exec: function(path) {
		var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
		file.initWithPath(path);
		if (!file.exists()) {
		    alert('路径并不存在：' + path);
		    return;
		}
		file.launch();
	},
	
	setIcon: function(img, obj) {
		if (obj.exec) {
		    var aFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
		    try {
		        aFile.initWithPath(obj.exec);
		    } catch (e) {
				this.log(e);
		        return;
		    }
		    if (!aFile.exists()) {
		        img.setAttribute('disabled', 'true');
		    } else {
		        var fileURL = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler).getURLSpecFromFile(aFile);
		        img.setAttribute('src', 'moz-icon://' + fileURL + '?size=16');
		    }
		    return;
		}

		var uri;
		try {
		    uri = Services.io.newURI(obj.url, null, null);
		} catch (e) {
			this.log(e);
		}
		if (!uri) return;

		PlacesUtils.favicons.getFaviconDataForPage(uri, {
		    onComplete: function(aURI, aDataLen, aData, aMimeType) {
		        try {
    			    //javascript: URI の host にアクセスするとエラー
    			    img.setAttribute('src', aURI && aURI.spec?
    			        'moz-anno:favicon:' + aURI.spec :
    			        'moz-anno:favicon:' + uri.scheme + '://' + uri.host + '/favicon.ico');
    			} catch (e) {
					myNewTabMod.log(e);
				}
		    }
		});
	}
};

addEventListener('load', function onLoad() {
	removeEventListener('load', onLoad, true);
	myNewTabMod.init();
}, false);
