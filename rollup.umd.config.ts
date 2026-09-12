import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const banner = `/*!
 * tournament-organizer -- Copyright (C) 2020 Matt Braddock
 * Licensed under the GNU General Public License v3 or later.
 * https://www.gnu.org/licenses/gpl-3.0.html
 */`;

const config = {
    input: 'src/index.ts',
    output: {
        banner,
        dir: 'dist',
        format: 'umd',
        name: 'tournament-organizer',
        entryFileNames: '[name].umd.js',
        globals: {
            crypto: 'require$$0'
        }
    },
    plugins: [
        commonjs(),
        nodePolyfills({
            sourceMap: true
        }),
        nodeResolve(),
        typescript()
    ]
};

export default config;
