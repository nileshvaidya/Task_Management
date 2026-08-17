// Import order matters here and can't be expressed as CSS @import (CSS
// spec requires @import to precede all other rules, which broke when
// Tailwind's own @tailwind directives were combined with an @import in one
// file — see CHANGELOG). Vite/Rollup concatenate JS-imported CSS in import
// order, so splitting into three files gives: Tailwind's reset first, then
// the Nocturne tokens/components on top of it, then Tailwind's component/
// utility layers last so a utility class can still override either.
import './styles/tailwind-base.css';
import './styles/nocturne.css';
import './styles/tailwind-components-utilities.css';
import './pwaInstall.js';
import { startRouter } from './router.js';

const app = document.getElementById('app');
startRouter(app);
