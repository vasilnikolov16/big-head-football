import { INK } from '../core/constants';

const outline = (ctx: CanvasRenderingContext2D, w = 3): void => {
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
};

/**
 * Shop hats, drawn on top of the head. Origin = head centre, +x = the way the
 * hero faces, R = head radius.
 */
export function drawHat(ctx: CanvasRenderingContext2D, id: string, R: number, t: number): void {
  if (id === 'none' || !id) return;
  ctx.save();
  switch (id) {
    case 'cap': {
      ctx.fillStyle = '#2f6fe0';
      ctx.beginPath();
      ctx.arc(0, -R * 0.42, R * 0.9, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
      ctx.fill();
      outline(ctx);
      // peak towards the front
      ctx.beginPath();
      ctx.ellipse(R * 0.85, -R * 0.5, R * 0.55, R * 0.12, 0.08, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -R * 1.3, R * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'party': {
      ctx.translate(-R * 0.1, -R * 0.8);
      ctx.rotate(-0.15);
      ctx.fillStyle = '#ff4d8d';
      ctx.beginPath();
      ctx.moveTo(-R * 0.45, 0);
      ctx.lineTo(R * 0.45, 0);
      ctx.lineTo(0, -R * 1.1);
      ctx.closePath();
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#ffd23f';
      for (const [x, y] of [
        [-0.12, -0.25],
        [0.15, -0.5],
        [-0.03, -0.78],
      ]) {
        ctx.beginPath();
        ctx.arc(R * x, R * y, R * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#4fd1ff';
      ctx.beginPath();
      ctx.arc(0, -R * 1.12, R * 0.13, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 2);
      break;
    }
    case 'santa': {
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.moveTo(-R * 0.9, -R * 0.55);
      ctx.quadraticCurveTo(-R * 0.2, -R * 1.7, -R * 1.25, -R * 1.05);
      ctx.lineTo(-R * 1.1, -R * 0.9);
      ctx.quadraticCurveTo(-R * 0.1, -R * 1.35, R * 0.9, -R * 0.55);
      ctx.closePath();
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-R * 0.98, -R * 0.68, R * 1.96, R * 0.26, R * 0.12);
      ctx.fill();
      outline(ctx);
      ctx.beginPath();
      ctx.arc(-R * 1.22, -R * 1.0, R * 0.16, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 2);
      break;
    }
    case 'tophat': {
      ctx.fillStyle = '#1b1b22';
      ctx.beginPath();
      ctx.roundRect(-R * 0.55, -R * 1.75, R * 1.1, R * 1.05, R * 0.06);
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#c1121f';
      ctx.fillRect(-R * 0.55, -R * 0.95, R * 1.1, R * 0.18);
      ctx.fillStyle = '#1b1b22';
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.72, R * 0.95, R * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx);
      break;
    }
    case 'propeller': {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(0, -R * 0.45, R * 0.85, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(0, -R * 0.45, R * 0.85, Math.PI * 1.37, Math.PI * 1.63);
      ctx.lineTo(0, -R * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillRect(-R * 0.04, -R * 1.5, R * 0.08, R * 0.22);
      // spinning blades
      const w = Math.cos(t * 30) * R * 0.75;
      ctx.fillStyle = '#4fd1ff';
      ctx.beginPath();
      ctx.ellipse(0, -R * 1.52, Math.abs(w) + 2, R * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 2);
      break;
    }
    case 'crown': {
      const g = ctx.createLinearGradient(0, -R * 1.5, 0, -R * 0.75);
      g.addColorStop(0, '#fff3a8');
      g.addColorStop(1, '#e0a400');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-R * 0.62, -R * 0.78);
      ctx.lineTo(-R * 0.7, -R * 1.42);
      ctx.lineTo(-R * 0.32, -R * 1.12);
      ctx.lineTo(0, -R * 1.55);
      ctx.lineTo(R * 0.32, -R * 1.12);
      ctx.lineTo(R * 0.7, -R * 1.42);
      ctx.lineTo(R * 0.62, -R * 0.78);
      ctx.closePath();
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(0, -R * 0.98, R * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4fd1ff';
      for (const x of [-0.4, 0.4]) {
        ctx.beginPath();
        ctx.arc(R * x, -R * 0.95, R * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'halo': {
      const bob = Math.sin(t * 3) * R * 0.05;
      ctx.strokeStyle = 'rgba(255,230,120,0.5)';
      ctx.lineWidth = R * 0.22;
      ctx.beginPath();
      ctx.ellipse(0, -R * 1.35 + bob, R * 0.62, R * 0.16, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = R * 0.09;
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
