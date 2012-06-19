/*global process */
/*jslint sloppy: true, sub: false, white: true, vars: true, eqeq: true, plusplus: true, nomen: true */

(function (exp) {
	
	function Injector () {
		var self = this;
		
		self.injectField = '$inject';
		self.configField = '$config';
		self.bindingPathSeparator = '->';
		
		self.classes = {};
	}
	
	var inArray = (function () {
		var res;
		if ('function' == typeof Array.prototype.indexOf) {
			res = function (array, el) {
				return array.indexOf(el);
			};
		} else {
			res = function (array, el) {
				var i, t;
				for (i = 0, t = array.length; i < t; i++) {
					if (array[i] === el) {
						return i;
					}
				}
				return -1;
			};
		}
		
		return res;
	}());
	
	function InjectorError (code, msg) {
		var e = new Error();
		
		e.code = code;
		
		if (typeof msg == 'string') {
			e.message = msg;
		}
		
		return e;
	}
	
	InjectorError.code = {
		'NOTREG': 'Class not found in registry',
		'CYCLE': 'Cyclic dependency detected',
		'SETTERNF': 'Attempted setter injection into non-function',
		'SETTERCTOR': 'Attempted setter injection into constructor parameters',
		'BINDNAME': 'Invalid binding name',
		'BINDERR': 'Invalid binding definition'
	};
	
	/**
	 * Binds `constructor` function to resolve `binding`. 
	 * @param {Object} binding
	 * @param {Object} constructor
	 * @param {Object} inject
	 */
	Injector.prototype.register = function (binding, constructor, inject) {
		var self = this;
		
		self.classes[binding] = {
			ctor: constructor,
			inject: inject || null
		};
		
		return self;
	};
	
	/**
	 * Binds binding to a value
	 * @param {Object} binding
	 * @param {Object} value
	 */
	Injector.prototype.set = function (binding, value) {
		var self = this;
		
		self.classes[binding] = {
			value: value
		};
		
		return self;
	};
	
	Injector.prototype._decodeInjectParams = function (C) {
		var self = this;
		var res = {}, inject = C[self.injectField], config = C[self.configField];
		
		// if it's an array, configure it to do constructor injection
		if (inject instanceof Array && inject.length > 0) {
			res.inject = inject;
		}
		
		if (config instanceof Array && config.length > 0) {
			res.config = config;
		}
		
		return res;
	};
	
	Injector.prototype._getBinding = function (binding, currentBindingPath) {
		var self = this;
		
		// if there is a cycle, throw error
		if (inArray(currentBindingPath, binding) > -1) {
			throw new InjectorError('CYCLE', 'Cyclic dependency detected in binding chain: ' + currentBindingPath.concat([binding]).join(self.bindingPathSeparator));
		}
		
		// start with the most specific path and go down to binding itself:
		var path = currentBindingPath.concat([binding]), strPath;
		while (path.length) {
			strPath = path.join(self.bindingPathSeparator);
			
			if ('undefined' != typeof self.classes[strPath]) {
				return self.classes[strPath];
			}
			
			// remove first element (go to less specific binding)
			path.shift();
		}
		
		// if no binding found, throw error
		throw new InjectorError('NOTREG', 'Binding "' + binding + '" is not registered');
	};
	
	Injector.prototype.create = function (binding, currentBindingPath) {
		var self = this;
		//console.log('125 ', arguments);
		// check currentBnidingPath
		if (!(currentBindingPath instanceof Array)) {
			currentBindingPath = [];	
		}
		
		var newBindingPath = currentBindingPath.concat([binding]);
		
		// if binding is a function, call it and pass injector
		if ('function' == typeof binding) {
			return binding(self, currentBindingPath);
		}
		
		var e = self._getBinding(binding, currentBindingPath);
		
		// if binding is bound to a value, just return it
		if (e.hasOwnProperty('value')) {
			return e.value;
		}
		
		var deps = {ctor: []}, i, inject;
		
		// if injections were reconfigured, new config takes priority
		if (e.inject instanceof Array || ('object' == typeof e.inject && e.inject !== null)) {
			inject = e.inject;
		} else {
			// if no injections configured, try $inject config from object constructor
			inject = self._decodeInjectParams(e.ctor);
		}
		
		// resolve constructor dependencies
		if (inject.inject) {
			for (i = 0; i < inject.inject.length; i += 1) {
				deps.ctor[i] = self.resolveConstructorDependency(inject.inject[i], newBindingPath, i, null);
			}
		}
		
		//console.log('170 ', inject, deps);
	
		// create substitute constructor-brother
		function F() {}
		F.prototype = e.ctor.prototype;
		
		var inst = new F();
	
		// perform constructor injection
		var maybeInst = e.ctor.apply(inst, deps.ctor);
		
		// if constructor returned something, we have to overwrite instance
		if ('undefined' != typeof maybeInst) {
			inst = maybeInst;
		}
		
		// resolve property and setter dependencies
		if (inject.config) {
			for (i = 0; i < inject.config.length; i++) {
				var prop = inject.config[i];
				
				self.resolveConfigDependency(prop, newBindingPath, i, inst);
			}
		}
		
		return inst;
	};
	
	Injector.prototype.resolveConstructorDependency = function (binding, bindingPath, index) {
		var self = this, res;
		
		// if binding is string, 
		if ('string' == typeof binding) {
			// treat it as another binding and go deeper
			return self.create(binding, bindingPath);
		}
		
		// if binding is a function, call it
		if ('function' == typeof binding) {
			return binding(self, bindingPath, index);
		}
		
		var pos = index + 1;
		pos = pos == 1 ? 'first' : pos == 2 ? 'second' : pos == 3 ? 'third' : pos + 'th';
		throw new InjectorError('BINDERR', 'Invalid ' + pos + ' binding in constructor for ' + bindingPath.join(self.bindingPathSeparator));
	};
	
	Injector.prototype.resolveConfigDependency = function (binding, bindingPath, index, instance) {
		var self = this, res, setter, prop, bindTo, value, mode, type;
		
		// if binding is a hash
		if ('object' == typeof binding && binding !== null) {
			// if setter is configured
			if ('undefined' != typeof binding.setter) {
				setter = binding.setter;
				mode = 'setter';
			}
			
			// if target property is configured
			if ('undefined' != typeof binding.property) {
				prop = binding.property;
				mode = 'property';
			}
			
			// if binding is configured
			if ('undefined' != typeof binding.binding) {
				bindTo = binding.binding;
				type = 'binding';
			}
			
			// if value configured
			if ('undefined' != typeof binding.value) {
				value = binding.value;
				type = 'value';
			}
			
			// sanity checks
			if (!mode) {
				throw new InjectorError('BINDERR', 'No target property or setter defined for config dependency ' + bindingPath.join(self.bindingPathSeparator));
			}
			
			if (!type) {
				throw new InjectorError('BINDERR', 'No binding or value defined for config dependency ' + bindingPath.join(self.bindingPathSeparator));
			}
		}
		
		// if binding is string, 
		if ('string' == typeof binding) {
			type = 'binding';
			
			// if binding is wrapped in "()"
			if (binding[0] == '(' && binding[binding.length - 1] == ')') {
				// treat it as a setter injection
				mode = 'setter';
				
				// remove parenthesis
				setter = bindTo = binding.slice(1, -1);
			} else {
				// otherwise, treat it as a property injection
				
				mode = 'property';
				prop = bindTo = binding;
			}
		}
		
		// resolve binding
		if (type == 'binding') {
			value = self.create(bindTo, bindingPath);
		}
		
		// apply property or setter
		if (mode == 'property') {
			instance[prop] = value;
		} else if (mode == 'setter') {
			
			// check if setter is actually a function
			if ('function' != typeof instance[setter]) {
				throw new InjectorError('SETTERNF', 'Attempted setter injection into non-function: ' + bindingPath.join(self.bindingPathSeparator) + '#' + setter);
			}
			
			instance[setter](value);
		}
		
		// TODO: callback bindings
		// if binding is a function, call it
		// if ('function' == typeof binding) {
			// return binding(self, bindingPath, paramName, instance);
		// }
	};
	
	exp.Injector = Injector;
}(
	(function () {
		// if nodejs
		if ('undefined' != typeof process) {
			return module.exports;
		}
		
		// browsers
		if ('undefined' != typeof window) {
			return window;
		}
	}())
));
