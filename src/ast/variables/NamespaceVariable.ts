import Variable from './Variable';
import { reservedWords } from '../../utils/identifierHelpers';
import Identifier from '../nodes/Identifier';
import { AstContext } from '../../Module';
import { RenderOptions } from '../../utils/renderHelpers';

export default class NamespaceVariable extends Variable {
	isNamespace: true;
	context: AstContext;

	// Not initialised during construction
	originals: { [name: string]: Variable } = Object.create(null);
	needsNamespaceBlock: boolean = false;
	private referencedEarly: boolean = false;
	private references: Identifier[] = [];

	constructor(context: AstContext) {
		super(context.getModuleName());
		this.context = context;
		for (const name of this.context.getExports().concat(this.context.getReexports())) {
			this.originals[name] = this.context.traceExport(name);
		}
	}

	addReference(identifier: Identifier) {
		this.references.push(identifier);
		this.name = identifier.name;
	}

	include() {
		if (!this.included) {
			this.included = true;
			this.needsNamespaceBlock = true;
			for (const identifier of this.references) {
				if (identifier.context.getModuleExecIndex() <= this.context.getModuleExecIndex()) {
					this.referencedEarly = true;
					break;
				}
			}
			for (const original of Object.keys(this.originals)) this.originals[original].include();
		}
	}

	renderFirst() {
		return this.referencedEarly;
	}

	renderBlock(options: RenderOptions) {
		const _ = options.compact ? '' : ' ';
		const nl = options.compact ? '' : '\n';

		const members = Object.keys(this.originals).map(name => {
			const original = this.originals[name];

			if ((this.referencedEarly || original.isReassigned) && !options.legacy) {
				return `${options.indent}get ${name}${_}()${_}{${_}return${_}${original.getName()};${_}}`;
			}

			if (options.legacy && reservedWords.indexOf(name) !== -1) name = `'${name}'`;
			return `${options.indent}${name}: ${original.getName()}`;
		});

		const name = this.getName();

		const callee = options.freeze
			? `${options.compact ? '' : '/*#__PURE__*/'}${
					options.legacy ? `(Object.freeze${_}||${_}Object)` : `Object.freeze`
			  }`
			: '';

		let output = `${this.context.varOrConst} ${name} = ${
			options.namespaceToStringTag
				? `{${nl}${members.join(`,${nl}`)}${nl}};`
				: `${callee}({${nl}${members.join(`,${nl}`)}${nl}});`
		}`;

		if (options.namespaceToStringTag) {
			const t = options.indent;
			output += `${nl}if${_}(typeof Symbol${_}!==${_}'undefined'${_}&&${_}Symbol.toStringTag)${nl}`;
			output += `${t}Object.defineProperty(${name},${_}Symbol.toStringTag,${_}{${_}value:${_}'Module'${_}});${nl}`;
			output += `else${nl}`;
			output += `${t}Object.defineProperty(${name},${_}'toString',${_}{${_}value:${_}function${_}()${_}{${_}return${_}'[object Module]'${_}}${_}});${nl}`;
			output += `${callee}(${name});`;
		}

		if (options.systemBindings && this.exportName) {
			output += `${nl}exports('${this.exportName}',${_}${name});`;
		}

		return output;
	}
}

NamespaceVariable.prototype.isNamespace = true;
