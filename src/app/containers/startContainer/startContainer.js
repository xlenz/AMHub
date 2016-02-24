angular.module('app.startContainer', [])

  .service('ContainerStartService',
    function (Container, ContainerService) {
      this.start = function (containerId, callback) {
        Container.start({
          id: containerId,
          privileged: true
        }, function () {
          console.log('Container started.');
          ContainerService.update();
          if (callback) callback();
        });
      }
    })

;

