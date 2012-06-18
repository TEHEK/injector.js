/*jslint sloppy: true, sub: false, white: true, vars: true, eqeq: true, plusplus: true, nomen: true */

beforeEach(function() {

	this.addMatchers({
		toBeInstanceOf: function(a) {
			return this.actual instanceof a;
		},
		toThrowErrorLike: function(regexp) {
			var fn = this.actual, thrown = false, match = true, err;
			
			try {
				fn();
				match = false;
				thrown = false;
			} catch (e) {
				err = e;
				match = e.message.match(regexp) !== null;
				console.log(e.message.match(regexp));
				thrown = true;
			}
			
			this.message = function () {
				if (!thrown) {
					return 'Expected error to be thrown, got nothing';
				}
				
				if (!match) {
					return 'Expected error message "' + err.message + '" to match ' + regexp
				}
			};
			
			return thrown && match;
		}
	});
	
});


describe('Injector', function () {
	
	var lib, subj, Injector;

	// if node.js
	if ('undefined' == typeof window && process && 'function' == typeof require) {
		lib = require('../../lib/injector');
		Injector = lib.Injector;
	}

	beforeEach(function () {
		subj = new lib.Injector();
	});
	
	it('should create injector', function () {
		expect(subj instanceof lib.Injector).toBe(true);
	});
	
	xdescribe('instance creation with #create', function () {
		var Class;
		beforeEach(function () {
			Class = function () {};
		});
	});
	
	describe('Pre-configured dependency resolution.', function () {
		var Class;
		beforeEach(function () {
			Class = function () {};
			subj.register('Class', Class);
		});
		
		describe('#create', function () {
			it('should recursively create objects for string-type bindigns');
			
			it('if binding is a callback, it should be called', function () {
				var spy = jasmine.createSpy();
				Class.$inject = [
					spy
				];
				
				var inst = subj.create('Class');
				
				expect(spy).toHaveBeenCalledWith(subj, ['Class'], 0, null);
			});
			
			it('if binding is a callback and $inject is a hash, it should pass instance to callback', function () {
				var spy = jasmine.createSpy().andCallFake(function(injector, bindingPath, paramName, instance) {
						instance[paramName] = 'value';
					});
				Class.$inject = {
					'param': spy
				};
				
				var inst = subj.create('Class');
				
				expect(spy).toHaveBeenCalledWith(subj, ['Class'], 'param', inst);
				expect(inst.param).toBe('value');
			});
		});
		
		describe('when $inject is an array', function () {
			it('should inject dependencies into constructor of created instance (constructor injection)', function () {
				Class = function (params) {
					this.params = params;
				};
				
				Class.$inject = ['params'];
				
				subj.register('Class', Class);
				subj.set('params', {
					test: 'Test'
				});
				
				var res = subj.create('Class');
				expect(
					res
				).toBeInstanceOf(Class);
				
				expect(
					res.params
				).toEqual({
					test: 'Test'
				});
			});
		});
		
		describe('when $inject is an object', function () {
			it('should do a property injection', function () {
				Class = function () {};
				Class.$inject = {
					params: 'params'
				};
				
				subj.register('Class', Class);
				subj.set('params', {
					test: 'Test'
				});
				
				var res = subj.create('Class');
				
				expect(res).toBeInstanceOf(Class);
				
				console.log(res);
				expect(
					res.params
				).toEqual({
					test: 'Test'
				});
			});
			
			it('should do a setter injection if binding is wrapped in "()"', function () {
				Class = function() {};
				Class.$inject = {
					'setParams' : '(params)'
				};
				Class.prototype.setParams = jasmine.createSpy();
				
				subj.register('Class', Class);
				subj.set('params', 'params value');
				
				var inst = subj.create('Class');
				
				expect(
					inst.setParams
				).toHaveBeenCalledWith('params value');
			});
			
			it('should throw descriptive error if setter injection applied to non-function', function () {
				Class = function() {};
				Class.$inject = {
					'setParams' : '(params)'
				};
				Class.prototype.setParams = 'not a function';
				
				subj.register('Class', Class);
				subj.set('params', 'params value');
				
				expect(function(){
					subj.create('Class');
				}).toThrowErrorLike(/Attempted setter injection into non-function: Class#setParams\(\)/);
			});
		});
	});
	
	describe('Manually configured dependency resolution.', function () {
		var Class;
		beforeEach(function () {
			Class = function () {};
			subj.register('Class', Class);
		});
		
		describe('Injector.Value', function () {
			it('should accept argument which will be used to inject dependency in constructor', function () {
				var value = {someValue: 10};
				Class = jasmine.createSpy();
				Class.$inject = [Injector.Value(value)];
				
				subj.register('Class', Class);
				
				var inst = subj.create('Class');
				
				expect(Class).toHaveBeenCalledWith(value);
			});
			
			it('should accept argument which will be used to inject property dependency', function () {
				var value = {someValue: 10};
				Class.$inject = {
					property: Injector.Value(value)
				};
				
				var inst = subj.create('Class');
				
				expect(inst.property).toBe(value);
			});
			
			xit('should be usable in `register`', function () {
				var value = {someValue: 10};
				
				subj.register('value', Injector.Value(value));
				
				expect(
					subj.create('value')
				).toBe(value);
			});
		});
		
		describe('Injector.Setter', function () {
			var Dependency, NestedDependency;
			
			beforeEach(function () {
				NestedDependency = jasmine.createSpy();
				Dependency = jasmine.createSpy();
				Dependency.$inject = ['NestedDependency'];
				
				subj.register('NestedDependency', NestedDependency);
				subj.register('Dependency', Dependency);
				
				Class.prototype.setter = jasmine.createSpy();
			});
			
			it('should accept binding as argument which will be recursively resolved', function () {
				Class.$inject = {
					setter: Injector.Setter('Dependency')
				};
				
				var inst = subj.create('Class');
				
				// check that setter was called and Dependency was created for it
				expect(inst.setter).toHaveBeenCalled();
				expect(inst.setter.argsForCall[0][0]).toBeInstanceOf(Dependency);
				
				// check that dependencies created recursively
				expect(NestedDependency).toHaveBeenCalled();
			});
			
			it('should accept Injector.Value as binding', function () {
				var value = {someValue: 10};
				Class.$inject = {
					setter: Injector.Setter(Injector.Value(value))
				};
				
				var inst = subj.create('Class');
				
				expect(inst.setter).toHaveBeenCalledWith(value);
			});
		});
	});
});