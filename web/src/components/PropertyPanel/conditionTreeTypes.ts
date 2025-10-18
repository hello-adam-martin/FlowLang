// Type definitions for nested quantified condition tree

export type ConditionNode = SimpleConditionNode | QuantifierConditionNode;

export interface SimpleConditionNode {
  type: 'simple';
  id: string;
  value: string;
}

export interface QuantifierConditionNode {
  type: 'quantifier';
  id: string;
  quantifier: 'all' | 'any' | 'none';
  children: ConditionNode[];
}
