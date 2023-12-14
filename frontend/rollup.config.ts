import typescript from "@rollup/plugin-typescript";
import nodeResolve from '@rollup/plugin-node-resolve';

export default {
    "input": ["./src/list.ts", "./src/login.ts", "./src/password.ts", "./src/register.ts", "./src/reset.ts", "./src/vote.ts"],
    "plugins": [
        typescript({
            "tsconfig": "./tsconfig.json"
        }),
        nodeResolve({
            browser: true
        })],
	output: {
		format: 'es',
		dir: '../debug/www/javascript',
        sourcemap: true
	},
    watch: {
        include: './src/**'
    }
}