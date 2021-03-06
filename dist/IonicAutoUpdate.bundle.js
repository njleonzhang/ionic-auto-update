'use strict';

/**
 * @ngdoc service
 * @name ionicAutoUpdate.IonicAutoUpdate
 * @description
 * # IonicAutoUpdate
 * Service in the ionicAutoUpdate.
 */
angular.module('ionicAutoUpdate', []).service('IonicAutoUpdate', ["$q", "$timeout", "$cordovaFileTransfer", "$cordovaFileOpener2", "$filter", function ($q, $timeout, $cordovaFileTransfer, $cordovaFileOpener2, $filter) {
  var platform = window.ionic.Platform.platform();
  var startUpdateApp = void 0;
  var updateHandles = void 0;
  var _alertContent = void 0;

  function showAlert(message, title, buttonName) {
    var defer = $q.defer();
    if (window.navigator.notification) {
      window.navigator.notification.alert(message, // message
      function () {
        defer.resolve();
      }, // callback
      title, // title
      buttonName // buttonName
      );
    }
    return defer.promise;
  }

  function showConfirm(message, title, buttonLabels) {
    var defer = $q.defer();
    if (window.navigator.notification) {
      window.navigator.notification.confirm(message, // message
      function (buttonIndex) {
        defer.resolve(buttonIndex);
      }, // callback
      title, // title
      buttonLabels // buttonName
      );
    }
    return defer.promise;
  }

  function setJsonObj(key, obj) {
    window.localStorage[key] = JSON.stringify(obj);
  }

  function getJsonObj(key) {
    return JSON.parse(window.localStorage[key] || '{}');
  }

  function downloadApk(url, targetPath) {
    return $cordovaFileTransfer.download(url, targetPath, {}, true);
  }

  function openApk(targetPath) {
    return $cordovaFileOpener2.open(targetPath, 'application/vnd.android.package-archive');
  }

  function showProgress() {
    window.cordova.plugin.pDialog.init({
      theme: 'HOLO_DARK',
      progressStyle: 'HORIZONTAL',
      cancelable: false,
      title: '版本升级',
      message: '下载中...'
    });
  }

  function updateProgress(progress) {
    window.cordova.plugin.pDialog.setProgress(progress);
  }

  function hideProgress() {
    window.cordova.plugin.pDialog.dismiss();
  }

  function updateAndroidApp(opts) {
    var defer = $q.defer();
    showProgress();
    var targetPath = opts.path + opts.filename;
    var downloadProgress = 0;
    downloadApk(opts.url, targetPath).then(function (result) {
      console.log('下载成功', result);
      opts.downloadSuccessCb(result);
      hideProgress();
      openApk(targetPath).then(function () {
        console.log('打开成功');
        defer.resolve();
      }, function () {
        console.log('打开失败');
        defer.reject();
      });
    }, function (err) {
      console.log('下载失败', err);
      hideProgress();
      defer.reject(err);
    }, function (progress) {
      downloadProgress = Math.floor(progress.loaded / progress.total * 100);
      updateProgress(downloadProgress);
      if (downloadProgress > 99) {
        hideProgress();
      }
    });
    return defer.promise;
  }

  function updateIOSApp(opts) {
    var defer = $q.defer();
    window.cordova.InAppBrowser.open(opts.url, '_system');
    defer.resolve();
    return defer.promise;
  }

  function isToday(dateToCheck) {
    var actualDate = new Date();
    return actualDate.toDateString() === dateToCheck.toDateString();
  }

  function todayHasSuggest() {
    var upgradeSuggestionInfo = getJsonObj('upgradeSuggestionInfo');
    if (upgradeSuggestionInfo && isToday(new Date(upgradeSuggestionInfo.last_suggest_date))) {
      return true;
    }
    return false;
  }

  function forceUpDate() {
    var defer = $q.defer();
    showAlert(_alertContent, '更新提醒', '去更新').then(function () {
      startUpdateApp().then(function () {
        defer.resolve();
        $timeout(forceUpDate, 500);
      }, function () {
        defer.reject();
      });
    });
    return defer.promise;
  }

  function suggestUpDate(defer) {
    defer = defer || $q.defer();
    // 如果上一次提醒是今天,则不提醒了.
    if (todayHasSuggest()) {
      defer.reject();
    } else {
      showConfirm('新版本上线啦', '更新提醒', ['去更新', '暂不更新']).then(function (selectedButtonIndex) {
        if (selectedButtonIndex === 1) {
          startUpdateApp().then(function () {
            $timeout(angular.bind(null, suggestUpDate, defer), 500);
          }, function () {
            defer.reject();
          });
        } else if (selectedButtonIndex === 2) {
          var upgradeSuggestionInfo = {
            last_suggest_date: $filter('date')(new Date(), 'yyyy-MM-dd')
          };
          console.log(upgradeSuggestionInfo);
          setJsonObj('upgradeSuggestionInfo', upgradeSuggestionInfo);
          defer.reject();
        } else {
          defer.reject();
        }
      });
    }
    return defer.promise;
  }

  this.init = function (_ref) {
    var _ref$iOSDownloadUrl = _ref.iOSDownloadUrl,
        iOSDownloadUrl = _ref$iOSDownloadUrl === undefined ? '' : _ref$iOSDownloadUrl,
        _ref$androidDownloadU = _ref.androidDownloadUrl,
        androidDownloadUrl = _ref$androidDownloadU === undefined ? '' : _ref$androidDownloadU,
        _ref$path = _ref.path,
        path = _ref$path === undefined ? window.cordova.file.externalApplicationStorageDirectory : _ref$path,
        _ref$filename = _ref.filename,
        filename = _ref$filename === undefined ? 'new_version.apk' : _ref$filename,
        _ref$downloadSuccessC = _ref.downloadSuccessCb,
        downloadSuccessCb = _ref$downloadSuccessC === undefined ? function () {} : _ref$downloadSuccessC,
        _ref$alertContent = _ref.alertContent,
        alertContent = _ref$alertContent === undefined ? '在使用前您必须更新!' : _ref$alertContent;

    var options = {
      ios: {
        url: iOSDownloadUrl
      },
      android: {
        url: androidDownloadUrl,
        path: path,
        filename: filename,
        downloadSuccessCb: downloadSuccessCb
      }
    }[platform];

    if (!options.url) {
      throw new Error('undefined url');
    }

    startUpdateApp = {
      ios: function ios() {
        return updateIOSApp(options);
      },
      android: function android() {
        return updateAndroidApp(options);
      }
    }[platform];

    updateHandles = {
      force: function force() {
        return forceUpDate();
      },
      suggest: function suggest() {
        return suggestUpDate();
      }
    };

    _alertContent = alertContent;
  };

  this.start = function (updateType) {
    if (!startUpdateApp || !updateHandles) {
      throw new Error('AppUpdate not init');
    }
    return updateHandles[updateType].call();
  };
}]);