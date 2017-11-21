angular.module('app.startContainer', [])

  .service('ContainerStartService',
  function (Container, ContainerService) {
    this.start = function (containerId, callback) {
      Container.start({ id: containerId }, function () {
        console.log('Container started.')
        if (callback) callback()
        else ContainerService.update()
      })
    }
  })
