/*jslint sloppy: true, sub: false, white: true */

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
	
	describe('#register', function () {
		it('should register dependency in registry', function () {
			Class = function () {};
			subj.register('Class', Class);
			
			expect(subj.classes['Class']['ctor']).toBe(Class);
		});
	});
	
	describe('#set', function () {
		it('should bind dependency to value', function () {
			var test = {something: 'for nothing'};
			subj.set('value', test);
			
			expect(subj.classes['value'].value).toBe(test);
		});
	});
	
	describe('#create', function () {
		var Class;
		beforeEach(function () {
		});
		
		it('should create instances for bound classes', function () {
			Class = function () {};

			subj.register('Class', Class);

			expect(
				res = subj.create('Class')
			).toBeInstanceOf(Class);
		});
		
		it('should actually call constructor', function () {
			Class = jasmine.createSpy();
			subj.register('Class', Class);
			
			subj.create('Class');
			
			expect(
				Class
			).toHaveBeenCalledWith();
		});
		
		it('should return object returned by constructor if it does return something', function () {
			subj.register('Class', function () {
				return 'substitute';
			});
			
			expect(
				subj.create('Class')
			).toBe('substitute');
		});
		
		it('should return value if class path is bound to value', function () {
			subj.set('someThing', 10);
			
			expect(
				subj.create('someThing')
			).toEqual(10);
		});
		
		it('should throw error if binding not resolved', function () {
			expect(function () {
				subj.create('unresolved binding')
			}).toThrowErrorLike(/not found/);
		});
			
		it('should throw error when cyclic dependency detected', function () {
			var Dependency;
		
			Class = function () {};
			Class.$inject = ['Dependency'];
			
			Dependency = function () {};
			Dependency.$inject = ['Class'];
			
			subj.register('Class', Class);
			subj.register('Dependency', Dependency);
		
			expect(function () {
				subj.create('Class');
			}).toThrowErrorLike(/Cyclic dependency detected in binding chain: Class->Dependency->Class/);
		});
		
		describe('injection:', function () {
			
			describe('dependencies configured with `register`', function () {
				it('should be able to perform different types of injection', function () {
					Class = function (constructorParams) {
						this.params = constructorParams;
					};
					Class.prototype.someSetter = jasmine.createSpy();
					
					subj.register('Class', Class, {
						ctor: ['params'],
						properties: {
							'someProperty': 'value1',
							'someSetter': '(value2)'
						}
					});
					
					subj.set('params', 123);
					subj.set('value1', 1);
					subj.set('value2', 2);
					
					// test injections
					var res = subj.create('Class');
					expect(res.params).toEqual(123);
					expect(res.someProperty).toEqual(1);
					expect(res.someSetter).toHaveBeenCalledWith(2);
				});
				
				it('should take precendence above dependencies configured through `$inject` field', function () {
					Class = jasmine.createSpy();
					Class.$inject = ['constructorParam'];
					
					subj.register('Class', Class, {
						properties: {
							param: 'property'
						}
					});
					subj.set('property', 'value');
					
					var res;
					expect(function () {
						res = subj.create('Class');
					}).not.toThrow();
					
					expect(
						res.param
					).toBe('value');
					
					expect(
						Class
					).toHaveBeenCalled();
				});
			});
		});
		
		xdescribe('targeted bindings', function () {
		    beforeEach(function () {
		        Class = function () {};
		    });
		});
	});
});
