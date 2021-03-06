angular.module('app.createContainer', [
  'ui.router',
  'ui.bootstrap'
])

  .config(function config ($stateProvider) {
    var home = 'home'
    $stateProvider
      .state('createContainerMain', {
        parent: home,
        onEnter: function onEnter ($uibModal, $state) {
          $uibModal
            // handle modal open
            .open({
              // main view
              templateUrl: 'containers/createContainer/createContainer.tpl.html',
              controller: 'CreateContainerCtrl',
              backdrop: 'static'
            })
            .result.then(function () {
              // after clicking OK button
              $state.transitionTo(home)
            }, function () {
              // after clicking Cancel button or clicking background
              $state.transitionTo(home)
            })
        }
      })
      .state('createContainer', {
        url: 'images/:name/create',
        parent: 'createContainerMain',
        // nestead views
        views: {
          'bindingAddress@': {
            controller: 'BindingAddressCtrl',
            templateUrl: 'containers/bindingAddress/bindingAddress.tpl.html'
          }
        }
      })
  })

  .controller('CreateContainerCtrl',
    function CreateContainerCtrl ($scope, $rootScope, $stateParams, Cookies, Config, Image, Container, Env, ContainerService, $q) {
      var imageName = decodeURIComponent($stateParams.name)

      $scope.settings = Cookies.settings
      $scope.volumes = {}
      $scope.showVolumes = false
      $scope.environmentVariables = []
      var bindingVolumes = []

      $scope.isBatchCreate = false
      $scope.batchContainersCreated = 0
      $scope.canStartBacth = false
      $scope.batchStartIndex = 1
      $scope.batchEndIndex = 1
      var batchLimit = 100
      var batchKeyword = '{index}'
      $scope.hostnameRegex = /^(?!-)[a-zA-Z0-9-{}]{1,63}$/

      Config.get({}, function (config) {
        $scope.config = config
      })

      Image.get({
        id: imageName
      }, function (image) {
        $scope.image = image
        $scope.environmentVariables = image.Config.Env
        if (image.Config.Volumes) {
          $scope.showVolumes = true
          Object.keys(image.Config.Volumes).forEach(key => {
            $scope.volumes[key] = ''
          })
        }

        // remove PATH from environment variables. May be a dirty hack
        if ($scope.environmentVariables !== null && $scope.environmentVariables.length > 0 && $scope.environmentVariables[0].indexOf('PATH=') === 0) {
          $scope.environmentVariables.splice(0, 1)
        }
      })

      $scope.env = Env.get({})

      $scope.create = function () {
        bindingVolumes = []
        if (!$scope.createContainerForm.$valid) {
          return
        }

        removeBadEnvironmentVariables()

        if ($scope.isBatchCreate) return $scope.batchCreate()

        if ($scope.config.docker) {
          bindingVolumes.push('/var/run/docker.sock:/var/run/docker.sock')
          bindingVolumes.push($scope.env.DOCKER + ':/bin/docker')
        }

        Object.keys($scope.volumes).forEach(key => {
          let vol = $scope.volumes[key].trim()
          if (vol) {
            bindingVolumes.push(`${vol}:${key}`)
          }
        })

        Container.create({
          Image: imageName,
          name: $scope.name,
          env: $scope.environmentVariables,
          Hostname: $scope.name,
          Privileged: true,
          CapAdd: ['NET_ADMIN'],
          Binds: bindingVolumes
        }, function (created) {
          console.log('Container created.')
          ContainerService.update()
          // close after creation
          $scope.$close()
        })
      }

      $scope.batchCreate = function () {
        if ($scope.batchEndIndex <= $scope.batchStartIndex ||
          $scope.batchEndIndex - $scope.batchStartIndex > batchLimit ||
          $scope.batchStartIndex < 0 ||
          !$scope.name.includes(batchKeyword)) {
          return window.alert('Start index should be > end index\n' + batchKeyword + ' should exist in name\nBatch create limit: ' + batchLimit)
        }

        var i = $scope.batchStartIndex
        var doubleCheckCounter = 0
        var qArr = []
        for (; i <= $scope.batchEndIndex && doubleCheckCounter < batchLimit; i++, doubleCheckCounter++) {
          var indexWithLeadingZeros = pad(i, 4)
          var containerName = $scope.name.replace(new RegExp(batchKeyword, 'g'), indexWithLeadingZeros)
          var environmentVariables = []

          if ($scope.environmentVariables) {
            for (var j = 0; j < $scope.environmentVariables.length; j++) {
              if ($scope.environmentVariables[j].includes(batchKeyword)) {
                environmentVariables.push($scope.environmentVariables[j].replace(new RegExp(batchKeyword, 'g'), indexWithLeadingZeros))
              } else {
                environmentVariables.push($scope.environmentVariables[j])
              }
            }
          }

          qArr.push({
            Image: imageName,
            name: containerName,
            env: environmentVariables,
            Hostname: containerName,
            Privileged: true,
            CapAdd: ['NET_ADMIN'],
            Binds: bindingVolumes
          })
        }

        function batchCreator () {
          if (qArr.length === 0) {
            return $scope.$close()
          }
          let createObj = qArr.shift()
          Container.create(createObj).$promise.catch(err => {
            window.alert('Failed to create container!')
            console.error(err)
            return $scope.$close()
          }).then(() => {
            $scope.batchContainersCreated++
            batchCreator()
          })
        }
        batchCreator()
      }

      function pad (num, size) {
        var s = num + ''
        while (s.length < size) s = '0' + s
        return s
      }

      var removeBadEnvironmentVariables = function () {
        if ($scope.environmentVariables === null || $scope.environmentVariables.length === 0) {
          return
        }
        var i = $scope.environmentVariables.length
        while (i--) {
          var element = $scope.environmentVariables[i]
          if (element === undefined || element === null || element.indexOf('=') === -1) {
            $scope.environmentVariables.splice(i, 1)
          }
        }
      }

      $scope.close = function () {
        $scope.$dismiss()
      }
    })
