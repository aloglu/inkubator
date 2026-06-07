(function () {
    function createRenderScheduler() {
        const queue = new Set();
        let pending = false;

        function flush() {
            pending = false;
            const tasks = Array.from(queue);
            queue.clear();
            for (const task of tasks) {
                try {
                    task();
                } catch (error) {
                    console.error('Render task failed:', error);
                }
            }
        }

        function schedule(task) {
            if (typeof task !== 'function') return;
            queue.add(task);
            if (pending) return;
            pending = true;
            const raf = typeof window !== 'undefined' && window.requestAnimationFrame;
            if (typeof raf === 'function') {
                raf(flush);
            } else {
                setTimeout(flush, 0);
            }
        }

        return { schedule, flush };
    }

    window.PenStationRenderScheduler = {
        createRenderScheduler
    };
})();
