angular.module('app.containers', [])

  .controller('ContainersCtrl',
    function ContainersCtrl ($scope, $uibModal, Cookies, ContainerService, ImageService, ContainerStartService, Container, $http) {
      $scope.settings = Cookies.settings
      $scope.searchThreshold = 30
      $scope.viewLimit = 30
      $scope.sort = '-Created'
      $scope.selectedAllContainers = false
      $scope.visibleContainers = []
      $scope.cpu = '?'
      $scope.ram = '?'

      $scope.update = function () {
        if (!$scope.selectedAllContainers) {
          return ContainerService.update()
        }
      }

      let conPing = true
      let cpuRamPing = true

      function conPinger (delay) {
        if (!conPing) return
        setTimeout(() => {
          if (!conPing) return
          let updPromise = $scope.update()
          if (!updPromise) {
            return conPinger()
          }
          updPromise.catch(() => {
            conPinger(21000)
          })
          updPromise.then(() => {
            conPinger()
          })
        }, delay || 8000)
      }
      conPinger()

      ContainerService.update().then(ImageService.update())

      $scope.imageFilter = ContainerService.imageFilter

      $scope.$on('$destroy', function () {
        conPing = false
      })

      $scope.selectAllContainers = function (visibleContainers) {
        $scope.visibleContainers = visibleContainers
        $scope.selectedAllContainers = !$scope.selectedAllContainers

        angular.forEach(visibleContainers, function (item) {
          item.Selected = $scope.selectedAllContainers
        })
      }

      $scope.selectContainer = function (isSelected, visibleContainers) {
        $scope.visibleContainers = visibleContainers
        if (isSelected) $scope.selectedAllContainers = true
        else {
          var noCheckboxSelected = true
          angular.forEach(visibleContainers, function (item) {
            if (noCheckboxSelected) {
              if (item.Selected) {
                noCheckboxSelected = false
              }
            }
          })
          if (noCheckboxSelected) $scope.selectedAllContainers = false
        }
      }

      $scope.actionSelected = function (actionSelectedName) {
        var selectedContainers = getSelectedContainers()
        if (selectedContainers.length === 0) return

        if (window.confirm(actionSelectedName + ' all selected containers (' + selectedContainers.length + ')?')) {
          switch (actionSelectedName) {
            case 'Start':
              let qArr = []
              angular.forEach(selectedContainers, function (containerId) {
                qArr.push(containerId)
              })

              let qDelay = 12000
              if (qArr.length > 14) {
                qDelay = 20000
              } else if (qArr.length > 22) {
                qDelay = 30000
              }
              let batchStarter = delay => {
                if (qArr.length === 0) {
                  $scope.selectedAllContainers = false
                  return
                }
                console.log('Containers left to be started:', qArr.length)
                let containerId = qArr.shift()
                delay = qArr.length === 0 ? 1 : delay
                ContainerStartService.start(containerId, data => {
                  ContainerService.update().then(data => {
                    setTimeout(() => {
                      batchStarter()
                    }, delay || qDelay)
                  })
                })
              }
              if (qArr.length > 1) {
                let qMsg = `Starting multiple containers with with delay ${qDelay / 1000} seconds! Please dont reload page!`
                console.log(qMsg)
                window.alert(qMsg + ' See browser console for details...')
                batchStarter(qDelay)
              } else {
                batchStarter(1)
              }
              break

            case 'Stop':
              angular.forEach(selectedContainers, function (containerId) {
                ContainerService.stop(containerId)
              })
              $scope.selectedAllContainers = false
              break

            case 'Remove':
              if (window.confirm('Double check before batch removal...')) {
                angular.forEach(selectedContainers, function (containerId) {
                  ContainerService.remove(containerId)
                })
                $scope.selectedAllContainers = false
              }
              break
          }
        }
      }

      function getSelectedContainers () {
        var selectedContainers = []
        angular.forEach($scope.visibleContainers, function (item) {
          if (item.Selected) {
            selectedContainers.push(item.Id)
          }
        })
        return selectedContainers
      }

      $scope.startContainer = function (containerId) {
        return ContainerStartService.start(containerId)
      }
      $scope.stopContainer = function (containerId) {
        ContainerService.stop(containerId)
      }

      function cpuRamPinger (delay) {
        if (!cpuRamPing) return

        setTimeout(() => {
          if (!cpuRamPing) return

          $http.post('/cpu').then(data => {
            $scope.cpu = data.data

            $http.post('/ram').then(data => {
              $scope.ram = data.data
              cpuRamPinger()
            }).catch(errIgnored => {
              cpuRamPinger(30000)
            })
          }).catch(errIgnored => {
            cpuRamPinger(30000)
          })
        }, delay || 3000)
      }
      cpuRamPinger()
    })

  .service('ContainerService',
    function ($rootScope, $q, Cookies, Config, Container) {
      var self = this
      $rootScope.containers = []
      $rootScope.runningContainers = 0

      this.init = function () {
        if (!$rootScope.containers) {
          return self.update()
        }
        return $q.when()
      }

      this.imageFilter = function (data, filters) {
        if (!data.Image) {
          return false
        }
        var name = data.Image
        filters = filters.split('|')
        for (var i in filters) {
          if (filters[i].charAt(0) !== '!' &&
            name.indexOf(filters[i]) !== -1) {
            return true
          } else if (name.indexOf(filters[i].slice(1)) !== -1) {
            return false
          }
        }
        return false
      }

      this.update = function () {
        // var settings = Cookies.settings

        // var advancedView = function (data, filters) {
        //   if (!settings.advanced) {
        //     filters += '|!alexagency/amhub'
        //   }
        //   return self.imageFilter(data, filters)
        // }

        var deferred = $q.defer()
        Container.query({}, function (containers) {
          var runningContainers = 0
          for (var i in containers) {
            if (containers[i].Names && containers[i].Names[0]) {
              containers[i].Name = containers[i].Names[0].slice(1)
            }
            if (containers[i].Status && containers[i].Status.includes('Up')) {
              runningContainers++
            }
          }
          $rootScope.containers = containers
          $rootScope.runningContainers = runningContainers
          return deferred.resolve()
        })
        return deferred.promise
      }

      this.getByName = function (name) {
        return self.init().then(function () {
          for (var i in $rootScope.containers) {
            var container = $rootScope.containers[i]
            if (container.Name) {
              if (container.Name === name) {
                return container
              }
            } else {
              return container // return first container without name
            }
          }
        })
      }

      this.getActive = function () {
        return self.init().then(function () {
          var containers = []
          for (var i in $rootScope.containers) {
            if ($rootScope.containers[i].Status.indexOf('Up') !== -1) {
              containers.push($rootScope.containers[i])
            }
          }
          return containers
        })
      }

      this.getFreeAddresses = function () {
        var deferred = $q.defer()
        Config.get({}, function (config) {
          var addresses = config.addresses
          self.init().then(function () {
            for (var i in $rootScope.containers) {
              var container = $rootScope.containers[i]
              for (var index in container.Ports) {
                if (container.Ports[index] && container.Ports[index].IP) {
                  var containerIp = container.Ports[index].IP
                  if (containerIp !== '0.0.0.0') {
                    for (var j in addresses) {
                      if (addresses[j].ip === containerIp) {
                        addresses.splice(j, 1)
                        break
                      }
                    }
                  }
                }
              }
            }
            deferred.resolve(addresses)
          })
        })
        return deferred.promise
      }

      this.remove = function (id) {
        return Container.remove({
          id: id
        }, function () {
          console.log('Container removed.')
          self.update()
        })
      }

      this.stop = function (id) {
        return Container.stop({
          id: id
        }, function () {
          console.log('Container stopped.')
          self.update()
        })
      }

      this.getAllByImage = function (imageName) {
        return self.init().then(function () {
          var imageContainers = []
          for (var i in $rootScope.containers) {
            var container = $rootScope.containers[i]
            if (container.Image === imageName) {
              imageContainers.push(container)
            }
          }
          return imageContainers
        })
      }

      this.removeAllByImage = function (imageName) {
        var deferred = $q.defer()
        self.init().then(function () {
          var promises = []
          for (var i in $rootScope.containers) {
            var container = $rootScope.containers[i]
            if (container.Image === imageName) {
              promises.push(self.remove(container.Id))
            }
          }
          $q.all(promises)
            .then(function (resolutions) {
              return deferred.resolve()
            })
        })
        return deferred.promise
      }

      this.getVisibleContainers = function () {
        console.log($rootScope.visibleContainers)
        return $rootScope.visibleContainers
      }
    })
