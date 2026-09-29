import ValidatorClass = require('./Validator');
import type * as types from './types';

declare namespace Validator {
	export type CustomAttributes = types.CustomAttributes;
	export type CustomMessages = types.CustomMessages;
	export type ExtensionFn = types.ExtensionFn;
	export type FieldError = types.FieldError;
	export type FieldRules = types.FieldRules;
	export type NestedRules = types.NestedRules;
	export type ParameterisedRule = types.ParameterisedRule;
	export type ReplacerFn = types.ReplacerFn;
	export type Rule = types.Rule;
	export type RuleClosure = types.RuleClosure;
	export type SimpleRule = types.SimpleRule;
	export type ValidationInput = types.ValidationInput;
	export type ValidationRules = types.ValidationRules;
}

const Validator = ValidatorClass;

export = Validator;
