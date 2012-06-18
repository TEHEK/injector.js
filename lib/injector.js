/*global process */
/*jslint sloppy: true, sub: false, white: true, vars: true, eqeq: true, plusplus: true, nomen: true */

(function (exp) {
	
	function Injector () {
		var self = this;
		
		self.configField = '$inject';
		self.bindingPathSeparator = ':';
		
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
		'BINDNAME': 'Invalid binding name'
	};
	
	function Dependency (dep) {
		if (dep instanceof Dependency) {
			return dep;
		}
		
		var self = this;
		
		// when dependency represented as string
		if ('string' == typeof dep) {
			// treat is as a binding
			
			// parse 
			var matches = dep.match(Dependency.BINDING_NAME_REGEXP);
			
			if (matches === null || matches.length < 3 || matches[1] == '') {
				throw new InjectorError('BINDNAME', 'Invalid binding name "' + dep + '"');
			}
			
			self.binding = matches[1];
			self.isValue = false;
			self.isOptional = (matches[2] == '?');
		} else if ('object' == typeof dep && dep !== null) {
			// if dependency is a hash
			// read parameters
			
		}
		
		self.type = 'property';
		self.optional = false;
		self.isValue = false;
		
		return self;
	}
	
	Dependency.BINDING_NAME_REGEXP = /^([a-z_\$][a-z0-9_\$]*)(\??)$/i;
	
	function Value (value) {
		var self = this;
		var dep = new Dependency();
		dep.value = value;
		dep.isValue = true;
		
		return dep;
	}
	
	
	
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
		var res = {}, config = C[self.configField];
		
		// if it's an array, configure it to do constructor injection
		if (config instanceof Array && config.length > 0) {
			res = {
				ctor: config
			};
		} else if ('object' == typeof config && config !== null) {
			// TODO: setter injection
			res = {
				properties: config
			};
		}
		
		return res;
	};
	
	Injector.prototype.isRegistered = function (binding) {
		var self = this;
		
		return self.classes.hasOwnProperty(binding);
	};
	
	Injector.prototype._getBinding = function (binding, currentBindingPath) {
		var self = this;
		
		if (!self.isRegistered(binding)) {
			throw new InjectorError('NOTREG', 'Binding "' + binding + '" not found in registry');
		}
		
		// if there is a cycle, throw error
		if (inArray(currentBindingPath, binding) > -1) {
			throw new InjectorError('CYCLE', 'Cyclic dependency detected in binding chain: ' + currentBindingPath.concat([binding]).join('->'));
		}
		
		return self.classes[binding];
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
		if (inject.ctor) {
			for (i = 0; i < inject.ctor.length; i += 1) {
				deps.ctor[i] = self.resolveConstructorDependency(inject.ctor[i], newBindingPath, i, null);
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
		if (inject.properties) {
			for (i in inject.properties) {
				if (inject.properties.hasOwnProperty(i)) {
					var prop = inject.properties[i];
					
					self.resolvePropertyDependency(prop, newBindingPath, i, inst);
				}
			}
		}
		
		return inst;
	};
	
	Injector.prototype.resolveConstructorDependency = function (binding, bindingPath, paramName, instance) {
		var self = this, res;
		
		// if binding is string, 
		if ('string' == typeof binding) {
			// treat it as another binding and go deeper
			return self.create(binding, bindingPath);
		}
		
		// if binding is a function, call it
		if ('function' == typeof binding) {
			return binding(self, bindingPath, paramName, instance);
		}
	};
	
	Injector.prototype.resolvePropertyDependency = function (binding, bindingPath, paramName, instance) {
		var self = this, res;
		
		// if binding is string, 
		if ('string' == typeof binding) {
			
			// if binding is wrapped in "()"
			if (binding[0] == '(' && binding[binding.length - 1] == ')') {
				// treat it as a setter injection
				Injector.Setter(binding.slice(1, -1))(self, bindingPath, paramName, instance);
			} else {
				// otherwise, treat it as a property injection
				instance[paramName] = self.create(binding, bindingPath);
			}
			
			return;
		}
		
		// if binding is a function, call it
		if ('function' == typeof binding) {
			return binding(self, bindingPath, paramName, instance);
		}
	};
	
	Injector.Value = function (value) {
		return function (injector, bindingPath, paramName, instance) {
			if (instance === null || 'object' != typeof instance) { 
				return value;
			} else {
				instance[paramName] = value;
			}
		};
	};
	
	Injector.Setter = function (binding) {
		return function (injector, bindingPath, paramName, instance) {
			if (instance === null || 'object' != typeof instance) {
				throw new InjectorError('SETTERCTOR', 'Attempted setter injection in constructor: ' + bindingPath.join('->') + '#' + paramName + '()');
			}
			
			if ('function' != typeof instance[paramName]) {
				throw new InjectorError('SETTERNF', 'Attempted setter injection into non-function: ' + bindingPath.join('->') + '#' + paramName + '()');
			}
			
			instance[paramName](injector.create(binding, bindingPath));
		};
	};
	
	Injector.Property = function (binding) {
		return function (injector, bindingPath, paramName, instance) {
			if (instance === null || 'object' != typeof instance) {
				throw new InjectorError('SETTERCTOR', 'Attempted setter injection in constructor: ' + bindingPath.join('->') + '#' + paramName + '()');
			}
			
			instance[paramName] = injector.create(binding, bindingPath);
		};
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
