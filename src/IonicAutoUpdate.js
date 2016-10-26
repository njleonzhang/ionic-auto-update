/**
 * @ngdoc service
 * @name ionicAutoUpdate.IonicAutoUpdate
 * @description
 * # IonicAutoUpdate
 * Service in the ionicAutoUpdate.
 */
angular.module('ionicAutoUpdate', [])
  .service('IonicAutoUpdate', function($q, $timeout, $cordovaFileTransfer, $cordovaFileOpener2, $filter) {
    let platform = window.ionic.Platform.platform()
    let startUpdateApp
    let updateHandles

    function showAlert(message, title, buttonName) {
      let defer = $q.defer()
      if (window.navigator.notification) {
        window.navigator.notification.alert(
          message, // message
          function() {
            defer.resolve()
          }, // callback
          title, // title
          buttonName // buttonName
        )
      }
      return defer.promise
    }

    function showConfirm(message, title, buttonLabels) {
      let defer = $q.defer()
      if (window.navigator.notification) {
        window.navigator.notification.confirm(
          message, // message
          function(buttonIndex) {
            defer.resolve(buttonIndex)
          }, // callback
          title, // title
          buttonLabels // buttonName
        )
      }
      return defer.promise
    }

    function setJsonObj(key, obj) {
      window.localStorage[key] = JSON.stringify(obj)
    }

    function getJsonObj(key) {
      return JSON.parse(window.localStorage[key] || '{}')
    }

    function downloadApk(url, targetPath) {
      return $cordovaFileTransfer.download(url, targetPath, {}, true)
    }

    function openApk(targetPath) {
      return $cordovaFileOpener2.open(targetPath, 'application/vnd.android.package-archive')
    }

    function showProgress() {
      window.cordova.plugin.pDialog.init({
        theme: 'HOLO_DARK',
        progressStyle: 'HORIZONTAL',
        cancelable: false,
        title: '版本升级',
        message: '下载中...'
      })
    }

    function updateProgress(progress) {
      window.cordova.plugin.pDialog.setProgress(progress)
    }

    function hideProgress() {
      window.cordova.plugin.pDialog.dismiss()
    }

    function updateAndroidApp(opts) {
      let defer = $q.defer()
      showProgress()
      let targetPath = opts.path + opts.filename
      let downloadProgress = 0
      downloadApk(opts.url, targetPath)
        .then(function(result) {
          console.log('下载成功', result)
          opts.downloadSuccessCb(result)
          hideProgress()
          openApk(targetPath).then(function() {
            console.log('打开成功')
            defer.resolve()
          }, function() {
            console.log('打开失败')
            defer.reject()
          })
        }, function(err) {
          console.log('下载失败', err)
          hideProgress()
          defer.reject(err)
        }, function(progress) {
          downloadProgress = Math.floor((progress.loaded / progress.total) * 100)
          updateProgress(downloadProgress)
          if (downloadProgress > 99) {
            hideProgress()
          }
        })
      return defer.promise
    }

    function updateIOSApp(opts) {
      let defer = $q.defer()
      window.cordova.InAppBrowser.open(opts.url, '_system')
      defer.resolve()
      return defer.promise
    }

    function isToday(dateToCheck) {
      let actualDate = new Date()
      return actualDate.toDateString() === dateToCheck.toDateString()
    }

    function todayHasSuggest() {
      let upgradeSuggestionInfo = getJsonObj('upgradeSuggestionInfo')
      if (upgradeSuggestionInfo && isToday(new Date(upgradeSuggestionInfo.last_suggest_date))) {
        return true
      }
      return false
    }

    function forceUpDate() {
      let defer = $q.defer()
      showAlert('在使用前您必须更新!', '更新提醒', '去更新').then(function() {
        startUpdateApp().then(function() {
          defer.resolve()
          $timeout(forceUpDate, 500)
        }, function() {
          defer.reject()
        })
      })
      return defer.promise
    }

    function suggestUpDate(defer) {
      defer = defer || $q.defer()
      // 如果上一次提醒是今天,则不提醒了.
      if (todayHasSuggest()) {
        defer.reject()
      } else {
        showConfirm('新版本上线啦', '更新提醒', ['去更新', '暂不更新']).then(function(selectedButtonIndex) {
          if (selectedButtonIndex === 1) {
            startUpdateApp().then(function() {
              $timeout(angular.bind(null, suggestUpDate, defer), 500)
            }, function() {
              defer.reject()
            })
          } else if (selectedButtonIndex === 2) {
            let upgradeSuggestionInfo = {
              last_suggest_date: $filter('date')(new Date(), 'yyyy-MM-dd')
            }
            console.log(upgradeSuggestionInfo)
            setJsonObj('upgradeSuggestionInfo', upgradeSuggestionInfo)
            defer.reject()
          } else {
            defer.reject()
          }
        })
      }
      return defer.promise
    }

    this.init = function({
      iOSDownloadUrl = '',
      androidDownloadUrl = '',
      path = window.cordova.file.externalApplicationStorageDirectory,
      filename = 'new_version.apk',
      downloadSuccessCb = function() {}
    }) {
      let options = {
        ios: {
          url: iOSDownloadUrl
        },
        android: {
          url: androidDownloadUrl,
          path,
          filename,
          downloadSuccessCb
        }
      }[platform]

      if (!options.url) {
        throw new Error('undefined url')
      }

      startUpdateApp = {
        ios() {
          return updateIOSApp(options)
        },
        android() {
          return updateAndroidApp(options)
        }
      }[platform]

      updateHandles = {
        force() {
          return forceUpDate()
        },
        suggest() {
          return suggestUpDate()
        }
      }
    }

    this.start = function(updateType) {
      if (!startUpdateApp || !updateHandles) {
        throw new Error('AppUpdate not init')
      }
      return updateHandles[updateType].call()
    }
  })
