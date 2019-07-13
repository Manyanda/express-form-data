"use strict";

const multipart = require('connect-multiparty');
const fse = require('fs-extra');
const fs = require('fs');
const formData = {};

function format (obj, fn) {
  for(let k in obj) {
    if(Array.isArray(obj[k])) {
      for(let i = 0, l = obj[k].length; i < l; i++) {
        obj[k][i] = fn(obj[k][i]);

        if(!obj[k][i]) {
          obj[k].splice(i, 1);
        }
      }

      if(!obj[k].length) {
        delete obj[k];
      }
    }
    else if(typeof obj[k] == 'object' && !obj[k].hasOwnProperty('originalFilename')) {
      format(obj[k], fn);

      if(!Object.keys(obj[k]).length) {
        delete obj[k];
      }
    }
    else {
      obj[k] = fn(obj[k]);

      if(!obj[k]) {
        delete obj[k];
      }
    }
  }
}

formData.parse = function (options) {
  return function (req, res) {
    res.on('finish', () => {
      const clean = [];

      for(let key in req.files) {
        const file = req.files[key];
        file instanceof fs.ReadStream && file.destroy && file.destroy();
        
        if(options && options.autoClean) {
          clean.push(fse.exists(file.path).then((exists) => {
            if(exists) {
              return fse.remove(file.path);
            }
          }));
        }
      }
      
      Promise.all(clean).catch(err => console.log(err.stack));
    });

    return multipart(options).apply(this, arguments);
  }
};

formData.format = function () {
  return function (req, res, next) {
    const clean = [];

    format(req.files, obj => {
      if(obj.size <= 0) {
        clean.push(fse.remove(obj.path));
        return null;
      }

      return obj;
    });

    Promise.all(clean).then(() => next()).catch(next);
  };
};

formData.stream = function () {
  return function (req, res, next) {
    format(req.files, obj => fs.createReadStream(obj.path));
    next();
  };
};

formData.union = function () {
  return function (req, res, next) {
    Object.assign(req.body, req.files);
    next();
  };
};

module.exports = formData;
