/*
This file is part of http://www.github.com/jeanpaulrichter/top1000
This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 3
of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
*/

import { getChartData } from "./help.js";
import { ChartData, ChartInfo, FilterOptions, GameGroup } from "./types.js";

/**
 * Possible chart colors
 */
const colors = [
    "#7f0000", "#191970", "#ff4500", "#00ced1", "#dc143c",
    "#f4a460", "#0000ff", "#a020f0", "#adff2f", "#ff00ff",
    "#1e90ff", "#db7093", "#ffff54", "#7fffd4", "#556b2f",
    "#FF6633", "#FFB399", "#FF33FF", "#FFFF99", "#00B3E6",
    "#E6B333", "#3366E6", "#999966", "#99FF99", "#B34D4D",
    "#80B300", "#809900", "#E6B3B3", "#6680B3", "#66991A",
    "#FF99E6", "#CCFF1A", "#FF1A66", "#E6331A", "#33FFCC",
    "#66994D", "#B366CC", "#4D8000", "#B33300", "#CC80CC",
    "#66664D", "#991AFF", "#E666FF", "#4DB3FF", "#1AB399",
    "#E666B3", "#33991A", "#CC9999", "#B3B31A", "#00E680",
    "#4D8066", "#809980", "#E6FF80", "#1AFF33", "#999933",
    "#FF3380", "#CCCC00", "#66E64D", "#4D80CC", "#9900B3",
    "#E64D66", "#4DB380", "#FF4D4D", "#99E6E6", "#6666FF"
];

/**
 * Whitelist for shown game platforms
 */
const main_platforms = [
    "Game Boy",
    "PlayStation",
    "PlayStation 2",
    "PlayStation 3",
    "PlayStation 4",
    "PlayStation 5",
    "Wii",
    "SNES",
    "Xbox",
    "Xbox 360",
    "Xbox One",
    "DOS",
    "Atari ST",
    "Commodore 64",
    "Amiga",
    "Wii U",
    "SEGA Saturn",
    "SEGA Master System",
    "PSP",
    "Nintendo Switch",
    "Windows"
];

/**
 * Definitions of all statistics charts
 */
const charts: ChartInfo[] = [
    {
        "canvas": document.getElementById("chart_genre") as HTMLCanvasElement,
        "obj": undefined,
        "options": getPieChartOptions("Genres"),
        "type": "pie",
        "name": "genres"
    },
    {
        "canvas": document.getElementById("chart_gameplay") as HTMLCanvasElement,
        "obj": undefined,
        "options": getBarChartOptions("Gameplay"),
        "type": "bar",
        "name": "gameplay"
    },
    {
        "canvas": document.getElementById("chart_perspectives") as HTMLCanvasElement,
        "obj": undefined,
        "options": getPieChartOptions("Perspektiven"),
        "type": "doughnut",
        "name": "perspectives"
    },
    {
        "canvas": document.getElementById("chart_settings") as HTMLCanvasElement,
        "obj": undefined,
        "options": getBarChartOptions("Setting"),
        "type": "bar",
        "name": "settings"
    },
    {
        "canvas": document.getElementById("chart_topics") as HTMLCanvasElement,
        "obj": undefined,
        "options": getPieChartOptions("Themen"),
        "type": "pie",
        "name": "topics"
    },
    {
        "canvas": document.getElementById("chart_platforms") as HTMLCanvasElement,
        "obj": undefined,
        "options": getBarChartOptions("Platformen"),
        "type": "bar",
        "name": "platforms",
        "filter": main_platforms
    },
    {
        "canvas": document.getElementById("chart_years") as HTMLCanvasElement,
        "obj": undefined,
        "options": getBarChartOptions("Jahrzehnte"),
        "type": "bar",
        "name": "years"
    },
]

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

/**
 * Get chartjs options for pie chart
 * @param title Title of chart
 * @returns options object
 */
 function getPieChartOptions(title: string) {
    return {
        "responsive": true,
        "layout": {
            "padding": {
                "left": 20,
                "right": 20,
                "top": 0,
                "bottom": 30
            }
        },
        "datasets": {
            "pie": {
                "borderWidth": 1
            },
            "doughnut": {
                "borderWidth": 1
            }
        },
        "scales": {
            "x": {
                "grid": {
                    "display": false
                },
                "ticks": {
                    "display": false
                }
            },
            "y": {
                "grid": {
                    "display": false
                },
                "ticks": {
                    "display": false
                }
            }
        },
        "plugins": {
            "legend": {
                "display": true,
                "labels": {
                    "color": "rgb(255,255,255)"
                }
            },
            "title": {
                "display": true,
                "text": title,
                "color": "rgb(255,255,255)"
            }
        }
    };
}

/**
 * Get options for chartjs bar chart
 * @param title Title of chart
 * @returns Options object
 */
function getBarChartOptions(title: string) {
    return {
        "layout": {
            "padding": {
                "top": 0,
                "bottom": 30
            }
        },
        "indexAxis": "y",
        "datasets": {
            "bar": {
                "barThickness": 12,
                "maxBarThickness": 18,
                "minBarLength": 2,
            }
        },
        "scales": {
            "y": {
                "ticks": {
                    "color": "rgb(255,255,255)",
                    "font": {
                        "size": 9
                    }
                },
                "grid": {
                    "display": false
                }
            }
        },
        "responsive": true,
        "plugins": {
            "legend": {
                "display": false,
            },
            "title": {
                "display": true,
                "text": title,
                "color": "rgb(255,255,255)"
            }
        }
    };
}

/**
 * Get chartjs data object
 * @param info Input array
 * @param valid Positiv list (optional)
 * @returns 
 */
function getDataObj(info: GameGroup[], valid?: string[]): ChartData {
    const data: ChartData = {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
        }]
    };
    let color_i = 0;
    for(let i = 0; i < info.length; i++) {
        if(valid === undefined || valid.includes(info[i].name)) {
            data.labels.push(info[i].name);
            data.datasets[0].data.push(info[i].count);
            data.datasets[0].backgroundColor.push(colors[color_i]);
            color_i++;
        }
    }
    return data;
}

/**
 * Load statistics charts for current filter options
 * @param filter FilterOptions
 */
export function loadCharts(filter: FilterOptions) {
    getChartData(filter).then(data => {
        for(const chart of charts) {
            if(chart.obj !== undefined) {
                chart.obj.destroy();
            }
            chart.obj = new window.Chart(chart.canvas, {
                "type": chart.type,
                "data": getDataObj(data[chart.name], chart.filter),
                "options": chart.options
            });
        }
    }).catch(exc => {
        console.error(exc);
    });
}

