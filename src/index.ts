import ValidatorClass = require('./Validator');
import type * as types from './types';

declare namespace Validator {
	export type FieldError = types.FieldError;
	export type FieldRules = types.FieldRules;
	export type NestedRules = types.NestedRules;
	export type ParameterisedRule = types.ParameterisedRule;
	export type Rule = types.Rule;
	export type SimpleRule = types.SimpleRule;
	export type ValidationInput = types.ValidationInput;
	export type ValidationRules = types.ValidationRules;
}

const Validator = ValidatorClass;

export = Validator;
