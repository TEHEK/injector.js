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
				thrown = true;
			}
			
			this.message = function () {
				if (!thrown) {
					return 'Expected error to be thrown, got nothing';
				}
				
				if (!match) {
					return 'Expected error message "' + err.message + '" to match ' + regexp;
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
	
	describe('Pre-configured dependency resolution.', function () {
		var Class;
		beforeEach(function () {
			Class = function () {};
			subj.register('Class', Class);
		});
		
		describe('$inject', function () {
			it('should configure dependencies for constructor injection', function () {
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
		
		describe('$config', function () {
			it('should configure property and setter dependencies', function () {
				Class.$config = [
					{property: 'prop', binding: 'prop'}, 
					{setter: 'setValue', value: 'value'}
				];
				
				Class.prototype.setValue = function (value) {
					this.value = value;
				};
				
				var obj = {};
				subj.set('prop', obj);
				
				var inst = subj.create('Class');
				
				expect(inst.prop).toBe(obj);
				expect(inst.value).toBe('value');
			});
			
			it('should treat strings as property injection bindings', function () {
				Class.$config = ['property1', 'property2'];
				var obj = {};
				
				subj.set('property1', 1);
				subj.set('property2', obj);
				
				var inst = subj.create('Class');
				
				expect(inst.property1).toBe(1);
				expect(inst.property2).toBe(obj);
			});
			
			it('should treat strings surrounded by parenthesis as setter injection bindings', function () {
				Class.$config = ['(setProp)'];
				Class.prototype.setProp = jasmine.createSpy();
				
				var obj = {};
				
				subj.set('setProp', obj);
				
				var inst = subj.create('Class');
				
				expect(inst.setProp).toHaveBeenCalledWith(obj);
			});
			
			it('should throw descriptive error if setter injection applied to non-function', function () {
				Class = function() {};
				Class.$config = ['(setParams)'];
				
				Class.prototype.setParams = 'not a function';
				
				subj.register('Class', Class);
				subj.set('setParams', 'params value');
				
				expect(function(){
					subj.create('Class');
				}).toThrowErrorLike(/Attempted setter injection into non-function: Class#setParams/);
			});
		});
		
		describe('#register', function () {
			it('should bind binding to constructor', function () {
				subj.register('Class', Class);
				
				expect(
					subj.create('Class')
				).toBeInstanceOf(Class);
			});
			
			it('should allow specifying nested bindings with path separated by "->"', function () {
				var spy = jasmine.createSpy();
				var fail = jasmine.createSpy();
				
				Class.$inject = ['Dependency'];
				
				subj.register('Class->Dependency', spy);
				subj.register('Dependency', fail);
				
				subj.create('Class');
				
				expect(spy).toHaveBeenCalled();
				expect(fail).not.toHaveBeenCalled();
			});
		});
		
		describe('#create', function () {
			it('should recursively create objects for bindings', function () {
				var Dependency = jasmine.createSpy();
				subj.register('Dependency', Dependency);
								
				var obj = {};
				var Nested = jasmine.createSpy();
				
				Class.$inject = ['Dependency']
			});
			
			it('if binding is a callback, it should be called', function () {
				var spy = jasmine.createSpy();
				Class.$inject = [
					spy
				];
				
				var inst = subj.create('Class');
				
				expect(spy).toHaveBeenCalledWith(subj, ['Class'], 0);
			});
			
			it('should throw error if binding is not a string or function', function () {
				Class.$inject = [
					{}, [], 1
				];
				
				expect(function () {
					subj.create('Class');
				}).toThrowErrorLike(/Invalid first binding in constructor for Class/);
				
				subj.set('param', 1);
				Class.$inject = ['param', {}];
				
				expect(function() {
					subj.create('Class');
				}).toThrowErrorLike(/Invalid second binding in constructor for Class/);
				
				Class.$inject = ['param', 'param', {}];
				expect(function() {
					subj.create('Class');
				}).toThrowErrorLike(/Invalid third binding in constructor for Class/);
				
				Class.$inject = ['param', 'param', 'param', {}];
				expect(function() {
					subj.create('Class');
				}).toThrowErrorLike(/Invalid 4th binding in constructor for Class/);
			});
			
			xit('if binding is a callback and $inject is a hash, it should pass instance to callback', function () {
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
	});
	
	describe('Manually configured dependencies', function () {
		var Class, Dependency;
		beforeEach(function () {
			Class = jasmine.createSpy();
			subj.register('Class', Class);
			
			Dependency = jasmine.createSpy();
			subj.register('Dependency', Dependency);
		});
		
		it('should be configurable with #register', function () {
			subj.register('Class', Class, {
				inject: ['Dependency'],
				config: [{
					property: 'param',
					value: 10
				}]
			});
			
			subj.create('Class');
			
			expect(Class).toHaveBeenCalled();
			expect(Dependency).toHaveBeenCalled();
			expect(Class.argsForCall[0][0]).toBeInstanceOf(Dependency);
		});
		
		it('should take precedence over pre-configured injections', function () {
			Class.$config = [{property: 'param', value: 'fail'}];
			subj.register('Class', Class, {
				config: [{
					property: 'param', value: 'win'
				}]
			});
			
			var inst = subj.create('Class');
			
			expect(inst.param).toBe('win');
		});
	});
});