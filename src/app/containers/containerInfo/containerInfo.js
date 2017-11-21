angular.module('app.containerInfo', [
  'ui.router',
  'ui.bootstrap'
])

  .config(function config ($stateProvider) {
    var home = 'home'
    $stateProvider
      .state('containerInfo', {
        url: 'containers/:name',
        parent: home,
        onEnter: function onEnter ($uibModal, $state) {
          $uibModal
            // handle modal open
            .open({
              templateUrl: 'containers/containerInfo/containerInfo.tpl.html',
              controller: 'ContainerInfoCtrl',
              size: 'lg'
            })
            .result.then(function () {
              // after clicking OK button
            }, function () {
              // after clicking Cancel button or clicking background
              $state.transitionTo(home)
            })
        }
      })
  })

  .controller('ContainerInfoCtrl',
    function ContainerInfoCtrl ($scope, $stateParams, $location, $interval, ContainerService, Container) {
      var top = () => new Promise((resolve, reject) => Container.top({ id: $scope.container.Id }, data => {
        $scope.top = data
        resolve()
      }, err => { reject(err) })
    )

      let conPing = true
      $scope.$on('$destroy', function () {
        console.log('destr')
        conPing = false
      })

      function conPinger (delay) {
        if (!conPing) return
        setTimeout(() => {
          if (!conPing) return
          let updPromise = top()
          if (!updPromise) { return conPinger() }
          updPromise.catch(() => { conPinger(15000) })
          updPromise.then(() => { conPinger() })
        }, delay || 5000)
      }

      Container.get({ id: $stateParams.name }, data => {
        $scope.container = data
        if (data.State.Running) {
          top()
          conPing = true
          conPinger()
        }
      })

      $scope.connectHTTP = function (ip, port) {
        if (ip === '0.0.0.0') {
          ip = $location.host()
        }
        $scope.targeturl = 'http://' + ip + ':' + port
      }

      $scope.connectHTTPS = function (ip, port) {
        if (ip === '0.0.0.0') {
          ip = $location.host()
        }
        $scope.targeturl = 'https://' + ip + ':' + port
      }

      $scope.connectRDP = function (ip, port) {
        if (ip === '0.0.0.0') {
          ip = $location.host()
        }
        var blob =
          new Blob(['auto connect:i:1\n' +
            'full address:s:' + ip + ':' + port + '\n' +
            'username:s:user\n' +
            'redirectclipboard:i:1'
          ], {
            type: 'text/plain;charset=' + document.characterSet
          })
        // FileSaver.js
        saveAs(blob, $scope.container.Config.Hostname + '.rdp')
      }

      $scope.close = function () {
        $scope.$dismiss()
      }
    })
