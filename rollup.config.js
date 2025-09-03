import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import sizes from 'rollup-plugin-sizes';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `/**
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * ${pkg.homepage}
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * Released under the ${pkg.license} License
 */`;

const config = [
  // Development build (unminified)
  {
    input: 'src/standalone.ts',
    output: {
      file: 'dist/standalone/lcp-performance-tracer.js',
      format: 'umd',
      name: 'LCPPerformanceTracer',
      sourcemap: true,
      banner,
      globals: {}
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.standalone.json',
        declaration: false
      }),
      sizes({
        details: true
      })
    ],
    external: []
  },
  // Production build (minified)
  {
    input: 'src/standalone.ts',
    output: {
      file: 'dist/standalone/lcp-performance-tracer.min.js',
      format: 'umd',
      name: 'LCPPerformanceTracer',
      sourcemap: true,
      banner,
      globals: {}
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.standalone.json',
        declaration: false
      }),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true,
          pure_funcs: ['console.debug']
        },
        format: {
          comments: /^!/
        }
      }),
      sizes({
        details: true
      })
    ],
    external: []
  }
];

export default config;