const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

const targetResize = `    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,`;

const replaceResize = `    const handleResize = () => {
      if (chartContainerRef.current) {
         chartRef.current?.applyOptions({ 
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight
         });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,`;

if (code.includes('height: 400,')) {
    code = code.replace(targetResize, replaceResize);
    
    // Also add ResizeObserver to the container
    const targetEffect = `    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };`;
    
    const replaceEffect = `    const resizeObserver = new ResizeObserver(() => {
       handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
    };`;
    
    code = code.replace(targetEffect, replaceEffect);
    fs.writeFileSync('src/components/CandlestickChart.tsx', code);
    console.log('Chart resizing patched');
} else {
    console.log('Target for resize not found');
}
