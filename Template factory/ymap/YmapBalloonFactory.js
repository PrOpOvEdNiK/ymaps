import YmapBalloonFactoryTools from './YmapBalloonFactoryTools';

/**
 * Для создания своих баллунов используем ymaps.templateLayoutFactory
 * Фабрика понимает шаблонизацию twig
 */
export default class YmapBalloonFactory {
    static objectContentLayout = `
        <div class="rgmap__balloon__body__image"
            style="background-image: url({{ properties.bImage }});"
        ></div>
        <div class="rgmap__balloon__body__title">{{ properties.bTitle }}</div>
        <div class="rgmap__balloon__body__text">{{ properties.bContent }}</div>
    `;

    static objectBaseLayout = `
        <div class="rgmap__balloon">
            <div class="rgmap__balloon__anchor"></div>
            <span class="rgmap__balloon__close"></span>
            <div class="rgmap__balloon__body">
                ${this.objectContentLayout}
            </div>
        </div>
    `;

    static clusterBaseLayout = `
        <div class="rgmap__balloon rgmap__balloon--cluster">
            <div class="rgmap__balloon__anchor"></div>
            <span class="rgmap__balloon__close"></span>
            <div class="rgmap__balloon__body rgmap__balloon__body--cluster">
                <ul class="rgmap__balloon__list">
                {% for geoObject in properties.geoObjects %}
                <li><a href="#" data-id="{{ geoObject.id }}" class="rgmap__balloon__list__item">
                    {{ geoObject.properties.cTitle }}
                </a></li>
                {% endfor %}
                </ul>
                <div class="rgmap__balloon__content">
                    ${this.objectContentLayout}
                </div>
            </div>
        </div>
    `;

    /**
     * Переопределим необходимые методы фабрики, чтобы получить полный контроль над баллунами
     * @see https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base-docpage/
     */
    static getBalloonFactoryOverrides = ymaps => ({
        /**
         * Строит экземпляр макета на основе шаблона и добавляет его в родительский HTML-элемент.
         * @see https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base-docpage/#method_detail__build
         */
        build: function () {
            YmapBalloonFactoryTools.buildCallback(this, ymaps);
        },
        /**
         * Удаляет содержимое макета из DOM.
         * @see https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base-docpage/#method_detail__clear
         */
        clear: function () {
            YmapBalloonFactoryTools.clearCallback(this);
        },
        /**
         * Используется для автопозиционирования (balloonAutoPan).
         * @see https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/ILayout-docpage/#method_detail__getShape
         * @see https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IShape-docpage/
         * @returns {Number[][]} Координаты левого верхнего и правого нижнего углов шаблона относительно точки привязки.
         */
        getShape: function () {
            return YmapBalloonFactoryTools.correctMapPan(this, ymaps);
        }
    });

    /**
     * @see https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/templateLayoutFactory-docpage/#method_detail__.createClass
     */
    static getClusterBalloon = ymaps => ymaps.templateLayoutFactory.createClass(
        this.clusterBaseLayout,
        this.getBalloonFactoryOverrides(ymaps)
    );

    static getObjectBalloon = ymaps => ymaps.templateLayoutFactory.createClass(
        this.objectBaseLayout,
        this.getBalloonFactoryOverrides(ymaps)
    );
}
