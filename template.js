define(function () {
    "use strict";

    /*
     * ПОЯСНЕНИЕ К КОДУ!
     * Шаблонизатор написан в функциональном стиле, все функции чистые и детермениррованые.
     * По возможности прменялись функции высшего порядка, map\reduce и т.д.
    * */

    var utils = {
        isString: function (string) {
            return typeof string === "string";
        },
        isObject: function (obj) {
            var type = typeof obj;
            return type === 'function' || (type === 'object' && !!obj);
        },
        isArray: function (obj) {
            return Array.isArray(obj);
        },
        toArray: function (obj) {
            return Array.prototype.slice.call(obj, 0);
        },
        cloneArray: function () {
            return this.toArray(arguments).reduce(function (array, value) {
                return array.concat(value);
            }, Array.prototype);
        }
    };

    /*Формируем регулярное выражение из массива list, регулярное выражение будет представлено ввиде объекта RegExp,
     *   Например getRegExp(['nblock', 'block'], 'i') вернет new RegExp('{%\\s*\\w+\\s*%}|{%\\s*\\.\\s*%}', 'i');
    */
    function getRegExp(list, flags) {
        var flags = flags || "",
            resultPattern,
            patternsBank = {
                'nblock': "{%\\s*\\w+\\s*%}",
                'block': "{%\\s*\\.\\s*%}",
                'value': "{{\\s*\\.([:\\w\\(\\)\'\"]+)*\\s*}}",
                'filter': ":[\\w:\\(\\)\"\',\\s]+",
                'close': '{%\\s*/\\s*%}',
                'substitution': '{{\\s*([A-z$_0-9]+)(:.+?)*\\s*}}',
                'arguments': '\\((.*)\\)',

                'fromNblock': "^{%\\s*(\\w+)\\s*%}",
                'fromValue': "^{{\\s*\\.(:\\w+)*\\s*}}",
                'fromBlock': "^{%\\s*\\.\\s*%}",
                'fromClose': "^{%\\s*/\\s*%}"
            };

        resultPattern = list.reduce(function (result, name) {
            result.push(patternsBank[name]);
            return result;
        }, []).join('|');

        return new RegExp(resultPattern, flags);
    }

    /*
     Возвращает впереди стоящий в template от регулярного выражения (regExp) текст, если regExp не найден то возвращает
     template как есть.
     Например: sliceText("<table><tr>{% . %}<td>{{.}}</td>{% / %}</tr></table>", getRegExp('block')) вернет
     "<table><tr>"
     */
    function sliceText(template, regExp) {
        var match = regExp.exec(template);

        if (!!match) {
            return template.slice(0, match.index);
        }

        return template;
    }

    /*
     Если массив arr не существует, то создает его и возарвщает со элементом value, если существует, то добавляет
     в него value и возвращает.
     */
    function smartPush(arr, value) {
        //Создаем новый массив, что-бы функция была чистой (см. http://en.wikipedia.org/wiki/Pure_function)
        return (!!arr) ? utils.cloneArray(arr, value) : [value];
    }

    //Обработчики фильтров для конструкций {{ name }} и {{ . }}
    var filterHandlers = {

        'upper': function (value) {
            return (utils.isString(value)) ? value.toUpperCase() : value;
        },

        'lower': function (value) {
            return (utils.isString(value)) ? value.toLowerCase() : value;
        },

        'escape': function (value) {

            if (!utils.isString(value)) {
                return value;
            }

            var entityMap = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': '&quot;',
                "'": '&#39;',
                "/": '&#x2F;'
            };

            return String(value).replace(/[&<>"'\/]/g, function (s) {
                return entityMap[s];
            });
        },

        'trim': function (value) {
            return (utils.isString(value)) ? value.trim() : value;
        },

        'capitalize': function (value) {

            if (utils.isString(value)) {

                return value.split(" ").map(function (val) {
                    return val.charAt(0).toUpperCase() + val.slice(1);
                }).join(" ");

            }

            return value;
        },

        'default': function (value, arg) {
            return value || arg;
        }

    };

    /*
     Получаем массив объектов фильтров,
     объект со значениями name - название фильтра, args - массив аргументов фильтра
     */
    function getFilters(construction) {

        var result = construction.match(getRegExp(['filter']));
        if (!result) {
            return [];
        }

        //Получаем аргументы фильтра, фильтр может иметь 0 и более аргументов, как строковых так и числовых
        //
        function getArgs(value) {
            //Получаем строку с аргументами следующего вида:  " 'arg1' , 'arg2 ' "
            var match = value.match(getRegExp(['arguments']));
            if (match) {
                return match[1].trim().split(',').map(function (value) {
                    //Сначала удаляем не семантические пробелы, затем удаляем кавычки шаблона.
                    return value.trim().replace(/'|"/g, '');
                });
            }

            return [];
        }


        return result[0].split(":").slice(1).map(function (value) {

            return {
                name: value.match(/\w+/)[0],
                args: getArgs(value)
            };

        });

    }

    //Применить набор фильтров к значению
    function applyFilters(filters, value) {
        if (!filters) {
            return value;
        }
        return filters.reduce(function (val, filter) {
            return filterHandlers[filter.name].apply(null, utils.cloneArray(val, filter.args));
        }, value);
    }

    //Формируем синтаксическое дерево
    /*
     Важно!
     Парсер формирует деревья поблочно, берет корневой блок и разбирает его вместе с подблоками, возвращая при этом
     в итоговом объекте (result.template) часть шаблона с другими корневыми блоками если они остались или пустую строку,
     также парсер возвращает синтаксическое дерево result.tree
     Объект дерева имеет следующие свойства:
     type - тип конструкции (nblock - {% name %}...{% / %}, block - {% . %}...{% / %}, value - {{ . }} ),
     name - имя блока, актуально только для конструкции {% name %}...{% / %}
     prependText - Впередистоящий от конструкции текст,
     appendText - стоящий после конструкции текст,
     children - массив таких-же объектов поддеревьев
     */
    function parsing(template) {

        var tree = {},
            openMatch,
            closingRegExp = getRegExp(['fromClose']),
            subTree,
            closeMatch;

        //Отрезаем пробелы
        template = template.trim();

        //Сохраняем и вырезаем предшествующий блоку XML\HTML
        tree.prependText = sliceText(template, getRegExp(['nblock', 'block', 'value']));
        template = template.slice(tree.prependText.length);


        //Определяем тип блока
        if (openMatch = getRegExp(['fromNblock']).exec(template)) {
            tree.type = "nblock";
            tree.name = openMatch[1];

        } else if (openMatch = getRegExp(['fromBlock']).exec(template)) {
            tree.type = "block";
            tree.name = null;

        } else if (openMatch = getRegExp(['fromValue']).exec(template)) {
            tree.type = "value";
            tree.filters = getFilters(openMatch[0]);
            tree.name = null;

            //Если не можем найти конструкцию, то завершаем выполнение функции
        } else {
            return {
                tree: tree,
                template: template
            };
        }

        //Вырезаем начальную конструкцию блока
        template = template.slice(openMatch.index + openMatch[0].length);

        /* Если конструкция не блочная, то не ищем закрывающей конструкции, просто возвращаем результат
         и не разобранную часть программы */
        if (tree.type === "value" || template === "") {

            // Сохраняем и вырезаем идущий после блока XML\HTML
            tree.appendText = sliceText(template, getRegExp(['nblock', 'block', 'value', 'close']));
            template = template.slice(tree.appendText.length);

            return {
                tree: tree,
                template: template
            };
        }

        //Выполняем рекурсию, пока не достигнем закрывающего тега
        while (!(closingRegExp.test(template))) {

            subTree = parsing(template);

            //Складываем детей с свойство children
            tree.children = smartPush(tree.children, subTree.tree);

            //Получаем не разобранную часть шаблона
            template = subTree.template;
        }

        //Берем закрывающую конструкцию
        closeMatch = closingRegExp.exec(template);
        //Отрезаем закрывающий конструкцию
        template = template.slice(closeMatch.index + closeMatch[0].length);
        //Получаем Html от закрывающей конструкции до любой следующей конструкции шаблона
        tree.appendText = sliceText(template, getRegExp(['nblock', 'block', 'value', 'close']));

        //отрезаем полученный html
        template = template.slice(tree.appendText.length);

        return {
            tree: tree,
            template: template
        };
    }

    //Генерируем XML\HTML для каждого поддерева
    function executeChildren(list, children) {

        var result = "";

        if (!list) {
            return result;
        }
        /* В каждое поддерево отдаем массив, рекурсия будет продолжаться, до тех пор пока не будут
         найдены объекты type==="value", только тогда начнет завершатся и отдавать обработанные куски шаблона
         */
        list.forEach(function (value) {
            children.forEach(function (child) {
                result += evaluate(child, value);
            });
        });

        return result;
    }

    //Генерируем html код
    function evaluate(tree, data) {

        var dataUnit;

        // Блочные конструкции обрабатываются схожим образом
        if (tree.type === "nblock" || tree.type === "block") {
            dataUnit = (tree.type === "nblock") ? data[tree.name] : data;
            return tree.prependText + executeChildren(dataUnit, tree.children) + tree.appendText;
        }

        if (tree.type === "value") {
            return tree.prependText + applyFilters(tree.filters, data) + tree.appendText;
        }

        return tree.prependText;
    }

    /* Подстановка конструкции вида: {{ name }}|{{ name:filter1 }}, где name имя ключа из набора данных.
     Если ключа name нет в наборе, то подставляем пустую строку
     */
    function substitution(template, data) {
        return template.replace(getRegExp(['substitution'], 'g'),
            function (str, name) {
                if (data && data[name]) {
                    return applyFilters(getFilters(str), data[name]);
                }
                //Здесь мы не можем вернуть просто пустую строку, т.к. у значения может быть фильтр default
                return applyFilters(getFilters(str), '');

            });
    }

    //Удаляем комментарии
    function removeComments(template) {
        return template.replace(/{#.*?#}/g, "");
    }

    /* Основная функция шаблонизатора, вынесена в
     executeEngine для того что-бы была возможность частичного выполнения функции (partial function application) */
    function executeEngine(template, data) {

        var trees = [],
            result = "",
            parsingResult,
            templateState = template;

        templateState = removeComments(templateState);
        templateState = substitution(templateState, data);


        if (utils.isString(templateState) && (utils.isObject(data) || utils.isArray(data))) {

            //Выполняем разбор до тех пор пока строка template возвращаемая parsing не станет пустой.
            while (true) {
                parsingResult = parsing(templateState);
                trees.push(parsingResult.tree);
                templateState = parsingResult.template;

                //Выходим из цикла, если весь шаблон разобран
                if (!templateState) {
                    break;
                }
            }

            //Ренденрим деревья
            trees.forEach(function (value) {
                result += evaluate(value, data);
            });

            return result;

        }

        //В любой не понятной ситуации возвращаем не обработанный шаблон
        return template;

    }

    /*
     render имеет возможность частичного применения функции. Можно делать так:
     var staffTable = render(template, data);
     ,а можно так:
     var staffTableRenderer = render(template);
     staffTable(data) - вернет готовый шаблон
     при желании можно переписать функцию так что-бы была возможность кеширования.
     */
    function render() {
        if (arguments.length === 1) {
            return executeEngine.bind(null, arguments[0]);
        }

        return executeEngine.apply(null, utils.toArray(arguments));
    }

    //Интерфейс amd модуля
    return {
        getRegExp: getRegExp,
        getFilters: getFilters,
        sliceText: sliceText,
        smartPush: smartPush,
        parsing: parsing,
        executeChildren: executeChildren,
        evaluate: evaluate,
        executeEngine: executeEngine,
        render: render,
        substitution: substitution
    };

});

