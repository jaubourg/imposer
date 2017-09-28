"use strict";

// by keeping a reference to the native promise implementation internally
// we make it possible to override it with Imposer later on
module.exports = Promise;
