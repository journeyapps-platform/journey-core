import { describe, it, expect } from 'vitest';
import {
  ConstantTokenExpression,
  FormatShorthandTokenExpression,
  FormatString,
  FunctionTokenExpression,
  ObjectTokenExpression,
  PrimitiveConstantTokenExpression,
  ShorthandTokenExpression
} from '../src';

describe('FormatString', () => {
  it('should compile ConstantTokenExpressions', () => {
    expect(FormatString.compile('Plain text')).toEqual([
      new ConstantTokenExpression({ expression: 'Plain text', start: 0 })
    ]);

    expect(FormatString.compile('Plain 123')).toEqual([
      new ConstantTokenExpression({ expression: 'Plain 123', start: 0 })
    ]);

    // Missing end brace
    expect(FormatString.compile('{person.name')).toEqual([
      new ConstantTokenExpression({ expression: '{person.name', start: 0 })
    ]);

    // Escaped value
    expect(FormatString.compile('{{person.name}}')).toEqual([
      new ConstantTokenExpression({ expression: '{person.name}', start: 0 })
    ]);
  });

  it('should compile ShorthandTokenExpressions', () => {
    expect(FormatString.compile('{person.name}')).toEqual([
      new ShorthandTokenExpression({ expression: 'person.name', start: 0 })
    ]);
  });

  it('should compile FormatShorthandTokenExpressions', () => {
    expect(FormatString.compile('R{price:.2f}!')).toEqual([
      new ConstantTokenExpression({ expression: 'R', start: 0 }),
      new FormatShorthandTokenExpression({ expression: 'price', format: '.2f', start: 1 }),
      new ConstantTokenExpression({ expression: '!', start: 12 })
    ]);
  });

  it('should compile mix of TokenExpressions', () => {
    expect(FormatString.compile('{{some text}} more {serial} {something.other:.2f} {$:foo("bar")}')).toEqual([
      new ConstantTokenExpression({ expression: '{some text} more ', start: 0 }),
      new ShorthandTokenExpression({ expression: 'serial', start: 19 }),
      new ConstantTokenExpression({ expression: ' ', start: 27 }),
      new FormatShorthandTokenExpression({ expression: 'something.other', format: '.2f', start: 28 }),
      new ConstantTokenExpression({ expression: ' ', start: 49 }),
      new FunctionTokenExpression({
        expression: 'foo("bar")',
        start: 50,
        arguments: [new ConstantTokenExpression({ expression: 'bar' })]
      })
    ]);
  });

  describe('should compile FunctionTokenExpressions', () => {
    it('with no arguments', () => {
      expect(FormatString.compile('{$:foo()}')).toEqual([
        new FunctionTokenExpression({ expression: '$:foo()', start: 0 })
      ]);
    });

    it('with an primitive argument', () => {
      expect(FormatString.compile('{$:foo(2)}')).toEqual([
        new FunctionTokenExpression({
          expression: '$:foo(2)',
          start: 0,
          arguments: [new PrimitiveConstantTokenExpression({ expression: 2 })]
        })
      ]);
    });

    it('with an object argument', () => {
      expect(FormatString.compile('{ $:foo({myObject: 2}) }')).toEqual([
        new FunctionTokenExpression({
          expression: '$:foo({myObject: 2})',
          start: 0,
          arguments: [
            new ObjectTokenExpression({
              expression: '{myObject: 2}',
              properties: { myObject: new PrimitiveConstantTokenExpression({ expression: 2 }) }
            })
          ]
        })
      ]);

      expect(FormatString.compile('{ $:foo({myObject: {b: 1}}) }')).toEqual([
        new FunctionTokenExpression({
          expression: '$:foo({myObject: {b: 1}})',
          start: 0,
          arguments: [
            new ObjectTokenExpression({
              expression: '{myObject: {b: 1}}',
              properties: {
                myObject: new ObjectTokenExpression({
                  expression: '{b: 1}',
                  properties: { b: new PrimitiveConstantTokenExpression({ expression: 1 }) }
                })
              }
            })
          ]
        })
      ]);

      expect(FormatString.compile("{ $:fn({a: '}'}) }")).toEqual([
        new FunctionTokenExpression({
          expression: "$:fn({a: '}'})",
          start: 0,
          arguments: [
            new ObjectTokenExpression({
              expression: "{a: '}'}",
              properties: { a: new ConstantTokenExpression({ expression: '}' }) }
            })
          ]
        })
      ]);

      expect(FormatString.compile("{ $:fn({a: '{', b: '}'}) }")).toEqual([
        new FunctionTokenExpression({
          expression: "$:fn({a: '{', b: '}'})",
          start: 0,
          arguments: [
            new ObjectTokenExpression({
              expression: "{a: '{', b: '}'}",
              properties: {
                a: new ConstantTokenExpression({ expression: '{' }),
                b: new ConstantTokenExpression({ expression: '}' })
              }
            })
          ]
        })
      ]);
    });

    it('with a "{" argument', () => {
      // Ignore brackets in strings
      expect(FormatString.compile('{ $:foo("{") }')).toEqual([
        new FunctionTokenExpression({
          expression: '$:foo("{")',
          start: 0,
          arguments: [new ConstantTokenExpression({ expression: '{' })]
        })
      ]);

      expect(FormatString.compile("{ $:foo('{turtles}') }")).toEqual([
        new FunctionTokenExpression({
          expression: "$:foo('{turtles}')",
          start: 0,
          arguments: [new ConstantTokenExpression({ expression: '{turtles}' })]
        })
      ]);
    });

    it('with multiple arguments', () => {
      const [result] = FormatString.compile('{ $:foo(3, "xyz") }');
      expect(result).toBeInstanceOf(FunctionTokenExpression);
      expect(result.expression).toEqual('foo(3, "xyz")');
      expect((result as FunctionTokenExpression).functionName()).toEqual('foo');
      expect((result as FunctionTokenExpression).arguments).toEqual([
        new PrimitiveConstantTokenExpression({ expression: 3 }),
        new ConstantTokenExpression({ expression: 'xyz' })
      ]);
    });

    it('with mix of TokenExpressions', () => {
      expect(FormatString.compile('{$:foo(2)} {b}')).toEqual([
        new FunctionTokenExpression({
          expression: '$:foo(2)',
          start: 0,
          arguments: [new PrimitiveConstantTokenExpression({ expression: 2 })]
        }),
        new ConstantTokenExpression({ expression: ' ', start: 10 }),
        new ShorthandTokenExpression({ expression: 'b', start: 11 })
      ]);

      expect(FormatString.compile('{person.name} {$:foo()}')).toEqual([
        new ShorthandTokenExpression({ expression: 'person.name', start: 0 }),
        new ConstantTokenExpression({ expression: ' ', start: 13 }),
        new FunctionTokenExpression({ expression: '$:foo()', start: 14 })
      ]);

      expect(FormatString.compile('A B C {$:foo()} X Y Z')).toEqual([
        new ConstantTokenExpression({ expression: 'A B C ', start: 0 }),
        new FunctionTokenExpression({ expression: '$:foo()', start: 6 }),
        new ConstantTokenExpression({ expression: ' X Y Z', start: 15 })
      ]);
    });

    it('with incorrect usage of brackets', () => {
      // Incorrect usage of brackets, revert to constant
      expect(FormatString.compile('{$:foo({3, "xyz")}')).toEqual([
        new ConstantTokenExpression({ expression: '{$:foo({3, "xyz")}', start: 0 })
      ]);
    });
  });
});
