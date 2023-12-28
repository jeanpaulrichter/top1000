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

import { default as axios } from "redaxios";
import { GameChart, ChartData, FilterOptions, Statistics, GameCategory, GameCategoryEntry } from "./types.js";
import { Chart, ChartType, BarController, BarElement, CategoryScale, LinearScale, DoughnutController, ArcElement, PieController, Tooltip, Legend, ChartOptions } from "chart.js";

/**
 * Manages charts for game categories
 */
export class ChartManager {
    /**
     * Possible chart colors
     */
    private static colors = [
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
     * All registered game charts
     */
    private charts: GameChart[] = [];

    constructor() {
        Chart.register(CategoryScale);
        Chart.register(LinearScale);
        Chart.register(BarController);
        Chart.register(BarElement);
        Chart.register(DoughnutController);
        Chart.register(ArcElement);
        Chart.register(PieController);
        Chart.register(Tooltip);
        Chart.register(Legend);
    }

    /**
     * Add/Create new chart
     * 
     * @param el_canvas Canvas element for chart
     * @param type Type of chart
     * @param category Game category visualized by chart
     * @param title Title for chart
     * @param whitelist Whitelist for category entries (optional)
     * @param horizontal Horizontal bar chart (optional)
     * 
     */
    public add(el_canvas: HTMLCanvasElement, type: ChartType, category: `${GameCategory}`, title: string, whitelist?: string[], horizontal?: boolean) {
        this.charts.push({
            "category": category,
            "chart": new Chart(el_canvas, {
                "type": type,
                "options": this.getChartOptions(type, title, horizontal),
                "data": { "labels": [], "datasets": [] }
            }),
            "whitelist": whitelist
        });
    }

    /**
     * Load chart data from api
     * 
     * @param filter FilterOptions for request
     */
    public load(filter: FilterOptions): void {
        this.dataRequest(filter).then(data => {
            for(const chart of this.charts) {
                chart.chart.data = this.getChartData(data[chart.category], chart.whitelist);
                chart.chart.update("none");
            }
        }).catch(exc => {
            console.error(exc);
        });
    }

    /**
     * Query api for statistics data
     * 
     * @param filter FilterOptions
     * @returns Statistics
     * @throws Error
     */
    private async dataRequest(filter: FilterOptions) {
        let url = "/api/statistics?";
        if(filter.group !== "") {
            url += "&group=" + filter.group;
        }
        if(filter.gender !== "") {
            url += "&gender=" + filter.gender;
        }
        if(filter.age > 0) {
            url += "&age=" + filter.age;
        }
    
        const ret = await axios.get(url);
        if(ret.status === 200) {
            return ret.data as Statistics;
        } else {
            throw new Error(ret.statusText);
        }
    }

    /**
     * Get ChartData object for chartjs
     * 
     * @param info Statistics for category
     * @param whitelist Whitelist for entries (optional)
     * @returns ChartData
     */
    private getChartData(info: GameCategoryEntry[], whitelist?: string[]): ChartData {
        const data: ChartData = {
            "labels": [],
            "datasets": [{
                "data": [],
                "backgroundColor": [],
            }]
        };
        let color_i = 0;
        for(let i = 0; i < info.length; i++) {
            if(whitelist === undefined || whitelist.includes(info[i].name)) {
                data.labels.push(info[i].name);
                data.datasets[0].data.push(info[i].count);
                data.datasets[0].backgroundColor.push(ChartManager.colors[color_i]);
                color_i++;
            }
        }
        return data;
    }

    /**
     * Get ChartOptions object for chartjs
     * 
     * @param type Chart type
     * @param title Title of chart
     * @returns ChartOptions
     */
    private getChartOptions(type: ChartType, title: string, horizontal = false): ChartOptions {
        switch(type) {
            case "doughnut": case "pie": {
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
            case "bar": {
                return {
                    "layout": {
                        "padding": {
                            "top": 0,
                            "bottom": 30
                        }
                    },
                    "indexAxis": horizontal ? "x" : "y",
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
            default: {
                return {};
            }
        }
    }
}
