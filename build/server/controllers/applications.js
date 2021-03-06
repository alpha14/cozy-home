// Generated by CoffeeScript 1.8.0
var AppManager, Application, Manifest, autostop, fs, log, markBroken, randomString, recoverIconPath, request, saveIcon, sendError, sendErrorSocket, slugify, startedApplications, updateApp;

request = require("request-json");

fs = require('fs');

slugify = require('cozy-slug');

log = require('printit')({
  prefix: "applications"
});

Application = require('../models/application');

AppManager = require('../lib/paas').AppManager;

Manifest = require('../lib/manifest').Manifest;

autostop = require('../lib/autostop');

startedApplications = {};

sendError = function(res, err, code) {
  if (code == null) {
    code = 500;
  }
  if (err == null) {
    err = {
      stack: null,
      message: "Server error occured"
    };
  }
  console.log("Sending error to client :");
  console.log(err.stack);
  return res.send(code, {
    error: true,
    success: false,
    message: err.message,
    stack: err.stack
  });
};

sendErrorSocket = function(err) {
  console.log("Sending error through socket");
  return console.log(err.stack);
};

markBroken = function(res, app, err) {
  console.log("Marking app " + app.name + " as broken because");
  console.log(err.stack);
  app.state = "broken";
  app.password = null;
  if (err.result != null) {
    app.errormsg = err.message + ' :\n' + err.result;
  } else {
    app.errormsg = err.message + ' :\n' + err.stack;
  }
  return app.save(function(saveErr) {
    if (saveErr) {
      return sendError(res, saveErr);
    }
    return res.send({
      app: app,
      error: true,
      success: false,
      message: err.message,
      stack: err.stack
    }, 500);
  });
};

randomString = function(length) {
  var string;
  string = "";
  while (string.length < length) {
    string = string + Math.random().toString(36).substr(2);
  }
  return string.substr(0, length);
};

recoverIconPath = function(root, appli) {
  if (appli.iconPath != null) {
    return root + appli.iconPath;
  } else {
    return root + "client/app/assets/icons/main_icon.png";
  }
};

saveIcon = function(appli, callback) {
  var git, icon, name, root;
  if (callback == null) {
    callback = function() {};
  }
  if (appli != null) {
    git = (appli.git.split('/')[4]).replace('.git', '');
    name = appli.name.toLowerCase();
    root = "/usr/local/cozy/apps/" + name + "/" + name + "/" + git + "/";
    icon = recoverIconPath(root, appli);
    if (fs.existsSync(icon)) {
      return appli.attachFile(icon, {
        name: 'icon.png'
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null);
      });
    } else {
      root = "/usr/local/cozy/apps/" + name + "/" + git + "/";
      icon = recoverIconPath(root, appli);
      if (fs.existsSync(icon)) {
        return appli.attachFile(icon, {
          name: 'icon.png'
        }, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null);
        });
      } else {
        return callback(new Error("Icon not found"));
      }
    }
  } else {
    return callback(new Error('Appli cannot be reached'));
  }
};

updateApp = function(app, callback) {
  var data, manager;
  manager = new AppManager();
  data = {};
  if (app.password == null) {
    data.password = randomString(32);
  }
  return manager.updateApp(app, function(err, result) {
    var manifest;
    if (err != null) {
      callback(err);
    }
    if (app.state !== "stopped") {
      data.state = "installed";
    }
    manifest = new Manifest();
    return manifest.download(app, (function(_this) {
      return function(err) {
        if (err != null) {
          return callback(err);
        } else {
          data.permissions = manifest.getPermissions();
          data.widget = manifest.getWidget();
          data.version = manifest.getVersion();
          data.iconPath = manifest.getIconPath();
          data.needsUpdate = false;
          return app.updateAttributes(data, function(err) {
            saveIcon(app, function(err) {
              if (err) {
                return console.log(err.stack);
              } else {
                return console.info('icon attached');
              }
            });
            if (err) {
              callback(err);
            }
            return manager.resetProxy(function(err) {
              return callback(err);
            });
          });
        }
      };
    })(this));
  });
};

module.exports = {
  loadApplication: function(req, res, next, slug) {
    return Application.all({
      key: req.params.slug
    }, function(err, apps) {
      if (err) {
        return next(err);
      } else if (apps === null || apps.length === 0) {
        return res.send(404, {
          error: 'Application not found'
        });
      } else {
        req.application = apps[0];
        return next();
      }
    });
  },
  applications: function(req, res, next) {
    return Application.all(function(err, apps) {
      if (err) {
        return next(err);
      } else {
        return res.send({
          rows: apps
        });
      }
    });
  },
  getPermissions: function(req, res, next) {
    var manifest;
    manifest = new Manifest();
    return manifest.download(req.body, function(err) {
      var app;
      if (err) {
        next(err);
      }
      app = {
        permissions: manifest.getPermissions()
      };
      return res.send({
        success: true,
        app: app
      });
    });
  },
  getDescription: function(req, res, next) {
    var manifest;
    manifest = new Manifest();
    return manifest.download(req.body, function(err) {
      var app;
      if (err) {
        next(err);
      }
      app = {
        description: manifest.getDescription()
      };
      return res.send({
        success: true,
        app: app
      });
    });
  },
  getMetaData: function(req, res, next) {
    var manifest;
    manifest = new Manifest();
    return manifest.download(req.body, function(err) {
      var metaData;
      if (err) {
        next(err);
      }
      metaData = manifest.getMetaData();
      return res.send({
        success: true,
        app: metaData
      }, 200);
    });
  },
  read: function(req, res, next) {
    return Application.find(req.params.id, function(err, app) {
      if (err) {
        return sendError(res, err);
      } else if (app === null) {
        return sendError(res, new Error('Application not found'), 404);
      } else {
        return res.send(app);
      }
    });
  },
  icon: function(req, res, next) {
    var _ref, _ref1;
    if ((_ref = req.application) != null ? (_ref1 = _ref._attachments) != null ? _ref1['icon.png'] : void 0 : void 0) {
      return req.application.getFile('icon.png', (function() {})).pipe(res);
    }
    return saveIcon(req.application, (function(_this) {
      return function(err) {
        if (err) {
          return fs.createReadStream('./client/app/assets/img/stopped.png').pipe(res);
        }
        return req.application.getFile('icon.png', (function() {})).pipe(res);
      };
    })(this));
  },
  updatestoppable: function(req, res, next) {
    return Application.find(req.params.id, function(err, app) {
      var Stoppable, changes;
      if (err) {
        return sendError(res, err);
      } else if (app === null) {
        return sendError(res, new Error('Application not found'), 404);
      } else {
        Stoppable = req.body.isStoppable;
        Stoppable = Stoppable != null ? Stoppable : app.isStoppable;
        changes = {
          homeposition: req.body.homeposition || app.homeposition,
          isStoppable: Stoppable
        };
        return app.updateAttributes(changes, function(err, app) {
          autostop.restartTimeout(app.name);
          if (err) {
            return sendError(res, err);
          }
          return res.send(app);
        });
      }
    });
  },
  install: function(req, res, next) {
    req.body.slug = slugify(req.body.name);
    req.body.state = "installing";
    req.body.password = randomString(32);
    return Application.all({
      key: req.body.slug
    }, function(err, apps) {
      var manifest;
      if (err) {
        return sendError(res, err);
      }
      if (apps.length > 0 || req.body.slug === "proxy" || req.body.slug === "home" || req.body.slug === "data-system") {
        err = new Error("already similarly named app");
        return sendError(res, err, 400);
      }
      manifest = new Manifest();
      return manifest.download(req.body, function(err) {
        if (err) {
          return sendError(res, err);
        }
        req.body.permissions = manifest.getPermissions();
        req.body.widget = manifest.getWidget();
        req.body.version = manifest.getVersion();
        req.body.iconPath = manifest.getIconPath();
        return Application.create(req.body, function(err, appli) {
          var infos, manager;
          if (err) {
            return sendError(res, err);
          }
          res.send({
            success: true,
            app: appli
          }, 201);
          infos = JSON.stringify(appli);
          console.info("attempt to install app " + infos);
          manager = new AppManager();
          return manager.installApp(appli, function(err, result) {
            var msg;
            if (err) {
              markBroken(res, appli, err);
              sendErrorSocket(err);
              return;
            }
            if (result.drone != null) {
              appli.state = "installed";
              appli.port = result.drone.port;
              msg = "install succeeded on port " + appli.port;
              console.info(msg);
              saveIcon(appli, function(err) {
                if (err) {
                  return console.log(err.stack);
                } else {
                  return console.info('icon attached');
                }
              });
              return appli.save(function(err) {
                if (err) {
                  return sendErrorSocket(err);
                }
                console.info('saved port in db', appli.port);
                return manager.resetProxy(function(err) {
                  if (err) {
                    return sendErrorSocket(err);
                  }
                  return console.info('proxy reset', appli.port);
                });
              });
            } else {
              err = new Error("Controller has no " + ("informations about " + appli.name));
              if (err) {
                return sendErrorSocket(err);
              }
            }
          });
        });
      });
    });
  },
  uninstall: function(req, res, next) {
    var manager;
    req.body.slug = req.params.slug;
    manager = new AppManager();
    return manager.uninstallApp(req.application, function(err, result) {
      if (err) {
        return markBroken(res, req.application, err);
      }
      return req.application.destroy(function(err) {
        if (err) {
          return sendError(res, err);
        }
        return manager.resetProxy(function(err) {
          if (err) {
            return sendError(res, proxyErr);
          }
          return res.send({
            success: true,
            msg: 'Application succesfuly uninstalled'
          });
        });
      });
    });
  },
  update: function(req, res, next) {
    return updateApp(req.application, function(err) {
      if (err != null) {
        return markBroken(res, req.application, err);
      }
      return res.send({
        success: true,
        msg: 'Application succesfuly updated'
      });
    });
  },
  updateAll: function(req, res, next) {
    var broken, updateApps;
    broken = function(app, err) {
      console.log("Marking app " + app.name + " as broken because");
      console.log(err.stack);
      app.state = "broken";
      app.password = null;
      if (err.result != null) {
        app.errormsg = err.message + ' :\n' + err.result;
      } else {
        app.errormsg = err.message + ' :\n' + err.stack;
      }
      return app.save(function(saveErr) {
        if (saveErr != null) {
          return console.log(saveErr);
        }
      });
    };
    updateApps = function(apps, callback) {
      var app;
      if (apps.length > 0) {
        app = apps.pop();
        if ((app.needsUpdate != null) && app.needsUpdate) {
          switch (app.state) {
            case "installed":
            case "stopped":
              console.log("Update " + app.name + " (" + app.state + ")");
              return updateApp(app, (function(_this) {
                return function(err) {
                  if (err) {
                    broken(app, err);
                  }
                  return updateApps(apps, callback);
                };
              })(this));
            default:
              return updateApps(apps, callback);
          }
        } else {
          return updateApps(apps, callback);
        }
      } else {
        return callback();
      }
    };
    return Application.all((function(_this) {
      return function(err, apps) {
        return updateApps(apps, function(err) {
          if (err != null) {
            sendError(res, err);
          }
          return res.send({
            success: true,
            msg: 'Application succesfuly updated'
          });
        });
      };
    })(this));
  },
  start: function(req, res, next) {
    var manager;
    setTimeout(function() {
      if (startedApplications[req.application.id] != null) {
        delete startedApplications[req.application.id];
        return markBroken(res, req.application, {
          stack: "Installation timeout",
          message: "Installation timeout"
        });
      }
    }, 45 * 1000);
    if (startedApplications[req.application.id] == null) {
      startedApplications[req.application.id] = true;
      manager = new AppManager;
      return manager.start(req.application, function(err, result) {
        if (err && err !== "Not enough Memory") {
          delete startedApplications[req.application.id];
          return markBroken(res, req.application, err);
        } else if (err) {
          delete startedApplications[req.application.id];
          req.application.errormsg = err;
          req.application.state = "stopped";
          return req.application.save(function(saveErr) {
            if (saveErr) {
              return sendError(res, saveErr);
            }
            return res.send({
              app: req.application,
              error: true,
              success: false,
              message: err.message,
              stack: err.stack
            }, 500);
          });
        } else {
          req.application.state = "installed";
          req.application.port = result.drone.port;
          return req.application.save(function(err) {
            if (err) {
              delete startedApplications[req.application.id];
              return markBroken(res, req.application, err);
            }
            return manager.resetProxy(function(err) {
              delete startedApplications[req.application.id];
              if (err) {
                return markBroken(res, req.application, err);
              } else {
                return res.send({
                  success: true,
                  msg: 'Application running',
                  app: req.application
                });
              }
            });
          });
        }
      });
    } else {
      return res.send({
        error: true,
        msg: 'Application is already starting',
        app: req.application
      });
    }
  },
  stop: function(req, res, next) {
    var manager;
    manager = new AppManager;
    return manager.stop(req.application, function(err, result) {
      var data;
      if (err) {
        return markBroken(res, req.application, err);
      }
      data = {
        state: 'stopped',
        port: 0
      };
      return req.application.updateAttributes(data, function(err) {
        if (err) {
          return sendError(res, err);
        }
        return manager.resetProxy(function(err) {
          if (err) {
            return markBroken(res, req.application, err);
          }
          return res.send({
            success: true,
            msg: 'Application stopped',
            app: req.application
          });
        });
      });
    });
  }
};
